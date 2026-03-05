package main

import (
	"gorm.io/gorm"
	"log"
	"time"
)

func clean(db *gorm.DB) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	cleanFn := func() {
		log.Printf("Starting clean records ...")

		err := db.Exec(`
		DELETE FROM funding_rate_records where capture_time < CURRENT_TIME - INTERVAL 24 HOUR
	`).Error

		if err != nil {
			log.Printf("clean failed: %v", err)
		}
	}

	//cleanFn()

	for {
		select {
		case <-ticker.C:
			cleanFn()
		}
	}

}
