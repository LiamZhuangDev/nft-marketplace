import { ethers } from "ethers";
import EasySwapOrderBookABI from '../abis/EasySwapOrderBook.sol/EasySwapOrderBook.json';
import { parseEther } from "ethers";
import { TX_MESSAGE_EVENT, type TxMessageDetail } from "@/lib/tx-message";

// 定义枚举类型 - 与合约保持一致
export enum Side {
    List = 0,
    Bid = 1
}

export enum SaleKind {
    FixedPriceForCollection = 0,
    FixedPriceForItem = 1
}

// 定义接口类型 - 与合约结构保持一致
export interface Asset {
    tokenId: string | number;
    collection: string;
    amount: number; // 对应合约中的uint96
}

export interface Order {
    side: Side;
    saleKind: SaleKind;
    maker: string;
    nft: Asset;
    price: bigint;  // 对应合约中的Price(uint128)
    expiry: number; // 对应合约中的uint64
    salt: number;   // 对应合约中的uint64
}

// 合约地址（Sepolia）
// 注意：OrderBook 与 Vault 不是同一个地址。
const ORDERBOOK_CONTRACT_ADDRESS = "0x5dF9A3b6785017187119C5d41885B4ccc0c63a04";
const VAULT_CONTRACT_ADDRESS = "0x48Ab4A68075b8De0b2961cE447b1df872865A955";

function emitTxMessage(detail: TxMessageDetail) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(TX_MESSAGE_EVENT, { detail }));
}

async function resolveChainId(signer: ethers.Signer): Promise<number> {
    try {
        const network = await signer.provider?.getNetwork();
        return Number(network?.chainId || 11155111);
    } catch {
        return 11155111;
    }
}

/**
 * 授权NFT给Vault合约
 * @param signer ethers signer 实例
 * @param nftContractAddress NFT合约地址
 * @param tokenId 可选的特定token ID，不传则授权全部
 */
export async function approveNFT(
    signer: ethers.Signer,
    nftContractAddress: string,
    tokenId?: string | number
) {
    try {
        // ERC721标准接口
        const nftContract = new ethers.Contract(
            nftContractAddress,
            [
                'function approve(address to, uint256 tokenId) external',
                'function setApprovalForAll(address operator, bool approved) external',
                'function getApproved(uint256 tokenId) external view returns (address)',
                'function isApprovedForAll(address owner, address operator) external view returns (bool)',
                'function ownerOf(uint256 tokenId) external view returns (address)'
            ],
            signer
        );

        if (tokenId !== undefined) {
            // 授权特定token
            const tx = await nftContract.approve(VAULT_CONTRACT_ADDRESS, tokenId);
            await tx.wait();
            return tx.hash;
        } else {
            // 授权全部tokens
            const tx = await nftContract.setApprovalForAll(VAULT_CONTRACT_ADDRESS, true);
            await tx.wait();
            return tx.hash;
        }
    } catch (error: any) {
        throw new Error(`NFT授权失败: ${error.message}`);
    }
}

/**
 * 检查NFT是否已授权
 * @param signer ethers signer 实例
 * @param nftContractAddress NFT合约地址
 * @param owner NFT拥有者地址
 * @param tokenId 可选的特定token ID
 */
export async function checkNFTApproval(
    signer: ethers.Signer,
    nftContractAddress: string,
    owner: string,
    tokenId?: string | number
): Promise<boolean> {
    try {
        const nftContract = new ethers.Contract(
            nftContractAddress,
            [
                'function getApproved(uint256 tokenId) external view returns (address)',
                'function isApprovedForAll(address owner, address operator) external view returns (bool)'
            ],
            signer
        );

        // 检查全部授权
        const isApprovedForAll = await nftContract.isApprovedForAll(owner, VAULT_CONTRACT_ADDRESS);
        if (isApprovedForAll) {
            return true;
        }

        // 如果指定了tokenId，检查特定token的授权
        if (tokenId !== undefined) {
            const approvedAddress = await nftContract.getApproved(tokenId);
            return approvedAddress.toLowerCase() === VAULT_CONTRACT_ADDRESS.toLowerCase();
        }

        return false;
    } catch (error: any) {
        console.error('检查NFT授权失败:', error);
        return false;
    }
}

/**
 * 获取订单合约实例
 * @param signer ethers signer 实例
 */
function getOrderBookContract(signer: ethers.Signer) {
    const contract = new ethers.Contract(
        ORDERBOOK_CONTRACT_ADDRESS,
        EasySwapOrderBookABI.abi,
        signer
    );
    return contract;
}

/**
 * 创建NFT订单
 * @param signer ethers signer 实例
 * @param orders 订单数组
 * @param options 交易选项
 */
export async function makeOrders(
    signer: ethers.Signer,
    orders: Order[],
    options: {
        value?: string;  // 如果是买单需要支付ETH
        autoApprove?: boolean; // 是否自动授权NFT
    } = {}
) {
    const chainId = await resolveChainId(signer);
    try {
        const contract = getOrderBookContract(signer);
        const signerAddress = await signer.getAddress();
        
        // 验证订单数据
        for (const order of orders) {
            if (!ethers.isAddress(order.maker)) {
                throw new Error('无效的maker地址');
            }
            if (!ethers.isAddress(order.nft.collection)) {
                throw new Error('无效的NFT合约地址');
            }
            if (order.maker.toLowerCase() !== signerAddress.toLowerCase()) {
                throw new Error('Order maker必须是当前签名者');
            }
            if (order.price <= 0) {
                throw new Error('价格必须大于0');
            }
            if (order.salt === 0) {
                throw new Error('Salt不能为0');
            }
            if (order.expiry !== 0 && order.expiry <= Math.floor(Date.now() / 1000)) {
                throw new Error('过期时间必须大于当前时间');
            }
        }

        // 如果是挂单(List)，检查并授权NFT
        const listOrders = orders.filter(order => order.side === Side.List);
        if (listOrders.length > 0 && options.autoApprove) {
            for (const order of listOrders) {
                const isApproved = await checkNFTApproval(
                    signer,
                    order.nft.collection,
                    order.maker,
                    order.nft.tokenId
                );
                
                if (!isApproved) {
                    console.log(`正在授权NFT: ${order.nft.collection} #${order.nft.tokenId}`);
                    await approveNFT(signer, order.nft.collection, order.nft.tokenId);
                }
            }
        }

        // 调用合约方法
        // 处理value参数：如果是字符串（ETH值），转换为bigint（wei）
        const value = options.value ? parseEther(options.value) : parseEther('0');
        const tx = await contract.makeOrders(orders, {
            value: value,
        });
        emitTxMessage({
            type: "pending",
            title: "交易提交中",
            description: "订单交易已发送，等待链上确认...",
            txHash: tx.hash,
            chainId,
        });

        // 等待交易确认
        const receipt = await tx.wait();
        emitTxMessage({
            type: "success",
            title: "交易成功",
            description: "订单已上链确认",
            txHash: receipt.hash,
            chainId,
        });

        // 从事件中获取订单ID
        const orderKeys = receipt.logs
            ?.filter((log: any) => {
                try {
                    const parsed = contract.interface.parseLog(log);
                    return parsed?.name === 'LogMake';
                } catch {
                    return false;
                }
            })
            ?.map((log: any) => {
                const parsed = contract.interface.parseLog(log);
                return parsed?.args.orderKey;
            });

        return {
            orderKeys,
            transactionHash: receipt.hash
        };

    } catch (error: any) {
        emitTxMessage({
            type: "error",
            title: "交易失败",
            description: error?.message || "未知错误",
            chainId,
        });
        throw new Error(`创建订单失败: ${error.message}`);
    }
}

/**
 * 买家接受卖家挂单（通过 multicall 聚合调用）
 * 场景：买家直接按卖家要价购买 NFT。
 */
export async function buyNowWithMulticall(
    signer: ethers.Signer,
    params: {
        collection: string;
        tokenId: string | number;
        expirySeconds?: number;
    }
) {
    const chainId = await resolveChainId(signer);
    try {
        const contract = getOrderBookContract(signer);
        const signerAddress = await signer.getAddress();
        const expirySeconds = params.expirySeconds ?? 30 * 24 * 60 * 60; // 默认30天

        // 查询该 NFT 当前最佳卖单（List + FixedPriceForItem）
        const sellOrder = await contract.getBestOrder(
            params.collection,
            params.tokenId,
            Side.List,
            SaleKind.FixedPriceForItem
        );

        if (!sellOrder || !sellOrder.maker || sellOrder.maker === ethers.ZeroAddress) {
            throw new Error("当前没有可匹配的卖单");
        }

        const buyOrder: Order = {
            side: Side.Bid,
            saleKind: Number(sellOrder.saleKind),
            maker: signerAddress,
            nft: {
                tokenId: sellOrder.nft.tokenId.toString(),
                collection: sellOrder.nft.collection,
                amount: Number(sellOrder.nft.amount),
            },
            price: BigInt(sellOrder.price.toString()),
            expiry: Math.floor(Date.now() / 1000) + expirySeconds,
            salt: Date.now(),
        };

        // 当前前端 ABI 里未包含 multicall，单独声明接口调用
        const multicallContract = new ethers.Contract(
            contract.target,
            [
                "function multicall(bytes[] data, bool revertOnFail) payable returns (bool[] successes, bytes[] results)",
            ],
            signer
        );

        const matchOrderData = contract.interface.encodeFunctionData("matchOrder", [sellOrder, buyOrder]);
        const tx = await multicallContract.multicall([matchOrderData], true, {
            value: buyOrder.price,
        });
        emitTxMessage({
            type: "pending",
            title: "交易提交中",
            description: "购买交易已发送，等待链上确认...",
            txHash: tx.hash,
            chainId,
        });

        const receipt = await tx.wait();
        emitTxMessage({
            type: "success",
            title: "交易成功",
            description: "NFT 购买已完成",
            txHash: receipt.hash,
            chainId,
        });
        return {
            transactionHash: receipt.hash,
            sellOrder,
            buyOrder,
        };
    } catch (error: any) {
        emitTxMessage({
            type: "error",
            title: "交易失败",
            description: error?.message || "未知错误",
            chainId,
        });
        throw new Error(`直接购买失败: ${error.message}`);
    }
}

export default class OrderBookContract {
    private contract: ethers.Contract | null;
    private signer: ethers.Signer | null;

    constructor(signer?: ethers.Signer) {
        this.contract = null;
        this.signer = signer || null;
    }

    /**
     * 设置 signer
     * @param signer ethers signer 实例
     */
    setSigner(signer: ethers.Signer) {
        this.signer = signer;
        this.contract = getOrderBookContract(signer);
    }

    private ensureInitialized() {
        if (!this.signer || !this.contract) {
            throw new Error('OrderBookContract 未初始化，请先调用 setSigner()');
        }
    }

    public async getOrders(params: {
        collection: string,
        tokenId: number,
        side: number,      // 0: buy, 1: sell
        saleKind: number,  // 通常是固定价格或拍卖
        count: number,     // 想要获取的订单数量
        price?: bigint,
        firstOrderKey?: string
    }) {
        this.ensureInitialized();
        const zeroBytes32 = '0x' + '0'.repeat(64);

        const orders = await this.contract!.getOrders(
            params.collection,
            params.tokenId,
            params.side,
            params.saleKind,
            params.count,
            params.price || BigInt(0),    // 如果不需要价格过滤，传null
            params.firstOrderKey || zeroBytes32  // 如果是第一次查询，传null
        );
        
        // 处理返回的订单数据
        const formattedOrders = orders.resultOrders.map((order: any) => {
            return {
                maker: order.maker,
                nftContract: order.nft.collection,
                tokenId: order.nft.tokenId.toString(),
                price: ethers.formatEther(order.price),
                side: order.side,
                expiry: new Date(Number(order.expiry) * 1000).toLocaleString(),
                // 其他字段根据实际返回数据结构添加
            };
        });

        return {
            orders: formattedOrders,
            nextOrderKey: orders.nextOrderKey  // 用于分页查询
        };
    }

    async createOrder(orders: any[]) {
        this.ensureInitialized();
        const tx = await this.contract!.makeOrders(orders);
        return tx;
    }
}