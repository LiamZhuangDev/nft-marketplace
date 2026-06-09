CREATE TABLE IF NOT EXISTS indexer_checkpoints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    indexer_name VARCHAR(64) NOT NULL,
    last_indexed_block BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_chain_indexer (chain_id, indexer_name)
);

CREATE TABLE IF NOT EXISTS nft_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    order_id VARCHAR(66) NOT NULL,
    order_status VARCHAR(32) NOT NULL,
    order_type VARCHAR(32) NOT NULL,
    collection_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(128) NOT NULL,
    maker VARCHAR(42) NOT NULL,
    price DECIMAL(65, 0) NOT NULL,
    quantity_remaining BIGINT UNSIGNED NOT NULL,
    size BIGINT UNSIGNED NOT NULL,
    expire_time BIGINT UNSIGNED NOT NULL,
    salt BIGINT UNSIGNED NOT NULL,
    block_number BIGINT UNSIGNED NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_order_id (order_id),
    KEY idx_collection_token (chain_id, collection_address, token_id),
    KEY idx_maker_status (chain_id, maker, order_status)
);

CREATE TABLE IF NOT EXISTS nft_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    collection_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(128) NOT NULL,
    owner VARCHAR(42) NOT NULL,
    supply BIGINT UNSIGNED NOT NULL,
    list_price DECIMAL(65, 0) NULL,
    list_time BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_item (chain_id, collection_address, token_id),
    KEY idx_owner (chain_id, owner)
);

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

CREATE TABLE IF NOT EXISTS nft_activities (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    activity_type VARCHAR(32) NOT NULL,
    order_id VARCHAR(66) NOT NULL,
    counter_order_id VARCHAR(66) NOT NULL DEFAULT '',
    collection_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(128) NOT NULL,
    maker VARCHAR(42) NOT NULL,
    taker VARCHAR(42) NOT NULL,
    price DECIMAL(65, 0) NOT NULL,
    block_number BIGINT UNSIGNED NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_activity_log (tx_hash, log_index, activity_type),
    KEY idx_collection_token (chain_id, collection_address, token_id),
    KEY idx_order_id (order_id),
    KEY idx_counter_order_id (counter_order_id)
);
