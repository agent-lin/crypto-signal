package main

import (
	"fmt"
	"future-signal/binance"
	"future-signal/config"
	"future-signal/handlers"
	"future-signal/models"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"log"
	"time"
)

func main() {
	// 设置日志输出
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)

	log.Println("开始运行资金费率监控程序")

	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		log.Fatalf("Cannot load config: %v", err)
	}

	db, err := gorm.Open(mysql.Open(cfg.Dsn), &gorm.Config{
		//Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal(err)
	}
	if err := sqlDB.Ping(); err != nil {
		log.Fatal("Database ping failed:", err)
	}

	db.AutoMigrate(&models.FundingRateRecord{})
	db.AutoMigrate(&models.BackTestResult{})

	fmt.Println("✅ Successfully connected to MySQL!")

	r := gin.Default()
	r.Use(cors.Default())

	exchange := binance.NewBinanceExchange(cfg.APIKey, cfg.SecretKey)

	handler := &handlers.FundingHandler{DB: db, Ex: exchange}
	r.GET("/api/funding/latest", handler.GetLatestRecords)
	r.GET("/api/funding/volume-surge", handler.GetLatestWithVolumeSurge)
	r.GET("/api/ticker/24h", handler.GetTicker24Hr)
	r.GET("/api/funding/history", handler.GetFundingHistory)
	r.GET("/api/funding/stats", handler.GetStats)

	if cfg.StartWithRun {
		exchange.MonitorMarketFundingRate(db)
		handler.RunBacktestUpdate()
	}

	go handler.UpdateSignalPriceChange(db)
	//go clean(db)

	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		for range ticker.C {
			hasNewSignal := exchange.MonitorMarketFundingRate(db)
			if hasNewSignal {
				handler.RunBacktestUpdate()
			}
		}
	}()

	go func() {
		ticker := time.NewTicker(60 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if err := handler.RunBacktestUpdate(); err != nil {
				log.Printf("backtest update failed: %v", err)
			}
		}
	}()

	r.Run(":8666")
}
