CREATE TABLE `sale_counters` (
	`company_id` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
WITH numbered AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at,id) AS sequence FROM sales)
UPDATE sales SET data=json_set(data,'$.saleCode','C'||(SELECT sequence FROM numbered WHERE numbered.id=sales.id));
--> statement-breakpoint
INSERT INTO sale_counters(company_id,value) SELECT COALESCE(company_id,''),count(*) FROM sales GROUP BY company_id;
--> statement-breakpoint
CREATE TRIGGER sales_assign_code AFTER INSERT ON sales BEGIN
 INSERT INTO sale_counters(company_id,value) VALUES(COALESCE(NEW.company_id,''),1)
 ON CONFLICT(company_id) DO UPDATE SET value=value+1;
 UPDATE sales SET data=json_set(data,'$.saleCode','C'||(SELECT value FROM sale_counters WHERE company_id=COALESCE(NEW.company_id,''))) WHERE id=NEW.id;
END;
