package binance

import (
	"fmt"
	"future-signal/config"
	"github.com/adshao/go-binance/v2"
	"log"
	"testing"
)

func TestMACD(t *testing.T) {
	cfg, err := config.LoadConfig("../config.yaml")
	if err != nil {
		log.Fatalf("Cannot load config: %v", err)
	}

	symbol := "AXLUSDT"

	client := binance.NewFuturesClient(cfg.APIKey, cfg.SecretKey)
	client.Debug = true
	exchange := &Exchange{
		FuturesClient: client,
	}

	oiHistory, err := exchange.FetchOpenInterestHistory(symbol, "15m", 1)
	if err != nil {
		log.Printf("fetch kLine data: %v", err)
		return
	}

	fmt.Println(oiHistory[0].CMCCirculatingSupply)
	//volumes := make([]decimal.Decimal, len(latestKLines))
	//
	//for i, k := range latestKLines {
	//	//fmt.Println()
	//	fmt.Println("ki", i, k)
	//	volumes[i], _ = decimal.NewFromString(k.QuoteAssetVolume)
	//}
	//
	//sma := calculateSMA(volumes, 20)
	//for i, s := range sma {
	//	fmt.Println(i, ":", volumes[i].String(), s.String())
	//}

	//fmt.Printf("  %s: %.4f%% 开始价格：%s 结束价格：%s\n", symbol, 0.0, latestKLines[0].Close, latestKLines[len(latestKLines)-1].Close)
	//
	//isSurge := IsVolumeSurgedInLast8(latestKLines[0 : len(latestKLines)-5])
	//
	//emaCross := IsEMA7CrossAboveEMA21(latestKLines)
	//
	//isMACDHistogramExpanding15m := IsMACDHistogramExpandingInLast3(latestKLines)
	//
	//fmt.Println("-->", isSurge, emaCross, isMACDHistogramExpanding15m)
}
