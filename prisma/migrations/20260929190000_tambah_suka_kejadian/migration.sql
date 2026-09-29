-- Suka (jempol) pengunjung pada kejadian di umpan. Satu suka per perangkat per
-- kejadian: visitor_hash = sha256(ip|user agent). IP & user agent disimpan
-- mentah supaya bisa dipantau di CMS (/admin/suka).
CREATE TABLE event_likes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  visitor_hash CHAR(64) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  created_at TIMESTAMP(0) NULL,
  UNIQUE INDEX event_likes_event_id_visitor_hash_unique (event_id, visitor_hash),
  INDEX event_likes_created_at_index (created_at),
  CONSTRAINT event_likes_event_id_foreign FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE = InnoDB, CHARACTER SET = utf8mb4, COLLATE = utf8mb4_unicode_ci;
