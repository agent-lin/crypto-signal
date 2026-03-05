package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Config 总配置结构
type Config struct {
	StartWithRun bool   `yaml:"start_with_run"`
	Dsn          string `yaml:"dsn"`
	APIKey       string `yaml:"api_key"`
	SecretKey    string `yaml:"secret_key"`
}

// LoadConfig 从指定路径加载配置文件
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &cfg, nil
}
