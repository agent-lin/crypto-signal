package main

import (
	"context"
	"fmt"
	"strconv"
	"crypto-signal/binance"
	"crypto-signal/config"
	"crypto-signal/handlers"
	"crypto-signal/models"
	"crypto-signal/services"
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
	db.AutoMigrate(&models.SimulatedTrade{})

	fmt.Println("✅ Successfully connected to MySQL!")

	r := gin.Default()
	r.Use(cors.Default())

	exchange := binance.NewBinanceExchange(cfg.APIKey, cfg.SecretKey)
	tradeEngine := services.NewTradeEngine(db)

	handler := &handlers.FundingHandler{DB: db, Ex: exchange, TradeEngine: tradeEngine}
	r.GET("/api/funding/latest", handler.GetLatestRecords)
	r.GET("/api/funding/volume-surge", handler.GetLatestWithVolumeSurge)
	r.GET("/api/ticker/24h", handler.GetTicker24Hr)
	r.GET("/api/funding/history", handler.GetFundingHistory)
	r.GET("/api/funding/stats", handler.GetStats)
	
	// 模拟交易 API
	r.GET("/api/trades/stats", handler.GetTradeStats)
	r.GET("/api/trades/active", handler.GetActiveTrades)
	r.GET("/api/trades/history", handler.GetTradeHistory)

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

	// 模拟交易引擎 - 检查出场条件
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			// 获取最新价格并检查出场
			tickers, err := exchange.FuturesClient.NewListPriceChangeStatsService().Do(context.Background())
			if err != nil {
				continue
			}
			for _, t := range tickers {
				price, _ := strconv.ParseFloat(t.LastPrice, 64)
				tradeEngine.CheckExitConditions(price)
				tradeEngine.UpdateUnrealizedPnl(t.Symbol, price)
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
