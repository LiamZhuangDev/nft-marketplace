CREATE TABLE IF NOT EXISTS nft_collections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    collection_address VARCHAR(42) NOT NULL,
    floor_price DECIMAL(65, 0) NULL,
    active_listing_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_collection (chain_id, collection_address),
    KEY idx_floor_price (chain_id, floor_price)
);
