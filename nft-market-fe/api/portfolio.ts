import { request } from "./request";

type GetPortfolioParams = {
  filters: {
    user_addresses: string[];
  };
};
function GetPortfolio(params: GetPortfolioParams) {
  return request.get("/portfolio/collections", {
    params: {
      filters: JSON.stringify(params.filters),
    },
  });
}

type GetPortfolioBidsParams = {
  filters: {
    chain_id: number[];
    collection_addresses: string[];
    user_addresses: string[];
    page: number;
    page_size: number;
  };
};
function GetPortfolioBids(params: GetPortfolioBidsParams) {
  return request.get("/portfolio/bids", {
    params: {
      filters: JSON.stringify(params.filters),
    },
  });
}

type GetPortfolioItemsParams = {
  filters: {
    chain_id: number[];
    collection_addresses: string[];
    user_addresses: string[];
    page: number;
    page_size: number;
  };
};
function GetPortfolioItems(params: GetPortfolioItemsParams) {
  return request.get("/portfolio/items", {
    params: {
      filters: JSON.stringify(params.filters),
    },
  });
}

type ImportPortfolioItemParams = {
  chain_id: number;
  user_address: string;
  collection_address: string;
  token_id: string;
  logo_uri?: string;
};
function ImportPortfolioItem(params: ImportPortfolioItemParams) {
  return request.post("/portfolio/import-item", params);
}


export default {
  GetPortfolio,
  GetPortfolioBids,
  GetPortfolioItems,
  ImportPortfolioItem,
};
