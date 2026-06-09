ALTER TABLE nft_activities
    ADD COLUMN counter_order_id VARCHAR(66) NOT NULL DEFAULT '' AFTER order_id,
    ADD INDEX idx_counter_order_id (counter_order_id);
