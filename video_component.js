class CultivationVideoComponent {
    constructor() {
        this.twitch = window.Twitch ? window.Twitch.ext : null;
        this.auth = null;
        this.context = null;
        this.config = {};
        this.playerData = null;
        this.leaderboardData = [];
        this.notifications = [];
        this.isConnected = false;
        this.isHidden = false;
        
        // API 設定
        this.apiBaseUrl = 'http://172.25.241.201:3000/api';
        
        // 更新間隔
        this.updateIntervals = {
            player: 5000,      // 5秒更新玩家數據
            leaderboard: 10000, // 10秒更新排行榜
            notifications: 3000 // 3秒更新通知
        };
        
        this.intervals = {};
        
        this.init();
    }

    init() {
        console.log('初始化修練遊戲影片元件...');
        
        if (this.twitch) {
            this.setupTwitchCallbacks();
        } else {
            console.log('開發模式：未檢測到 Twitch Extensions SDK');
            this.initDevelopmentMode();
        }
        
        this.setupEventListeners();
        this.startUpdateCycles();
    }

    setupTwitchCallbacks() {
        // 當用戶授權時
        this.twitch.onAuthorized((auth) => {
            console.log('用戶已授權:', auth);
            this.auth = auth;
            this.loadPlayerData();
        });

        // 當上下文變化時
        this.twitch.onContext((context, delta) => {
            console.log('上下文變化:', context, delta);
            this.context = context;
            this.handleContextChange(context);
        });

        // 當可見性變化時
        this.twitch.onVisibilityChanged((isVisible, context) => {
            console.log('可見性變化:', isVisible);
            if (isVisible) {
                this.refreshAllData();
            }
        });

        // 當配置變化時
        this.twitch.configuration.onChanged(() => {
            console.log('配置變化');
            this.loadConfiguration();
        });

        // 監聽 PubSub 訊息
        this.twitch.listen('broadcast', (target, contentType, message) => {
            console.log('收到廣播訊息:', message);
            this.handleBroadcastMessage(message);
        });
    }

    initDevelopmentMode() {
        console.log('進入開發模式');
        this.auth = {
            token: 'dev-token',
            userId: 'dev-user-123',
            channelId: 'dev-channel-456'
        };
        
        this.context = {
            game: 'Just Chatting',
            language: 'zh-tw',
            theme: 'dark'
        };
        
        // 延遲載入以模擬真實情況
        setTimeout(() => {
            this.loadPlayerData();
        }, 1000);
    }

    setupEventListeners() {
        // 最小化按鈕
        document.getElementById('minimizeLeaderboard').addEventListener('click', () => {
            this.togglePanel('leaderboardPanel');
        });

        document.getElementById('minimizePlayer').addEventListener('click', () => {
            this.togglePanel('playerStatusPanel');
        });

        document.getElementById('minimizeNotifications').addEventListener('click', () => {
            this.togglePanel('notificationsPanel');
        });

        // 控制按鈕
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshAllData();
        });

        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('hideBtn').addEventListener('click', () => {
            this.toggleVisibility();
        });

        // 鍵盤快捷鍵
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                this.toggleVisibility();
            }
        });
    }

    handleContextChange(context) {
        // 根據上下文調整 UI
        if (context.theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    }

    loadConfiguration() {
        if (this.twitch && this.twitch.configuration) {
            const config = this.twitch.configuration.broadcaster;
            if (config && config.content) {
                this.config = JSON.parse(config.content);
                this.applyConfiguration();
            }
        }
    }

    applyConfiguration() {
        // 應用配置設定
        if (this.config.showLeaderboard === false) {
            this.hidePanel('leaderboardPanel');
        }
        
        if (this.config.showPlayerStatus === false) {
            this.hidePanel('playerStatusPanel');
        }
        
        if (this.config.showNotifications === false) {
            this.hidePanel('notificationsPanel');
        }
    }

    async loadPlayerData() {
        try {
            this.showLoading();
            const username = this.getUsernameFromAuth();
            
            if (!username) {
                console.log('無法獲取用戶名稱');
                this.hideLoading();
                return;
            }

            const response = await this.apiRequest(`/players/${username}`);
            
            if (response.success) {
                this.playerData = response.data;
                this.updatePlayerUI();
                this.setConnectionStatus(true);
            } else {
                console.error('載入玩家數據失敗:', response.message);
                this.setConnectionStatus(false);
            }
            
            this.hideLoading();
        } catch (error) {
            console.error('載入玩家數據錯誤:', error);
            this.setConnectionStatus(false);
            this.hideLoading();
        }
    }

    async loadLeaderboard() {
        try {
            const response = await this.apiRequest('/leaderboard?limit=5');
            
            if (response.success) {
                this.leaderboardData = response.data;
                this.updateLeaderboardUI();
            } else {
                console.error('載入排行榜失敗:', response.message);
            }
        } catch (error) {
            console.error('載入排行榜錯誤:', error);
        }
    }

    async loadNotifications() {
        try {
            const response = await this.apiRequest('/notifications/recent?limit=3');
            
            if (response.success) {
                this.notifications = response.data;
                this.updateNotificationsUI();
            } else {
                console.error('載入通知失敗:', response.message);
            }
        } catch (error) {
            console.error('載入通知錯誤:', error);
        }
    }

    updatePlayerUI() {
        if (!this.playerData) return;

        const playerName = document.getElementById('playerName');
        const playerRealm = document.getElementById('playerRealm');
        const expFill = document.getElementById('expFill');
        const expText = document.getElementById('expText');

        if (playerName) {
            playerName.textContent = this.playerData.username;
        }

        if (playerRealm) {
            playerRealm.textContent = `${this.playerData.realm} 第${this.playerData.level}層`;
        }

        if (expFill && expText) {
            const expProgress = (this.playerData.experience / this.playerData.expRequired) * 100;
            expFill.style.width = `${Math.min(expProgress, 100)}%`;
            expText.textContent = `${this.playerData.experience} / ${this.playerData.expRequired}`;
        }
    }

    updateLeaderboardUI() {
        const leaderboardList = document.getElementById('leaderboardList');
        if (!leaderboardList) return;

        leaderboardList.innerHTML = '';

        if (this.leaderboardData.length === 0) {
            leaderboardList.innerHTML = '<div class="no-data">暫無排行榜數據</div>';
            return;
        }

        this.leaderboardData.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <div class="rank">${index + 1}</div>
                <div class="player-info">
                    <div class="name">${player.username}</div>
                    <div class="realm">${player.realm} ${player.level}層</div>
                </div>
                <div class="exp">${this.formatNumber(player.totalExperience)}</div>
            `;
            leaderboardList.appendChild(item);
        });
    }

    updateNotificationsUI() {
        const notificationList = document.getElementById('notificationList');
        if (!notificationList) return;

        notificationList.innerHTML = '';

        if (this.notifications.length === 0) {
            notificationList.innerHTML = '<div class="no-data">暫無通知</div>';
            return;
        }

        this.notifications.forEach(notification => {
            const item = document.createElement('div');
            item.className = `notification-item ${notification.type}`;
            item.innerHTML = `
                <div class="notification-icon">${this.getNotificationIcon(notification.type)}</div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${this.formatTime(notification.createdAt)}</div>
                </div>
            `;
            notificationList.appendChild(item);
        });
    }

    showCultivationResult(result) {
        const resultElement = document.getElementById('cultivationResult');
        const resultIcon = document.getElementById('resultIcon');
        const resultText = document.getElementById('resultText');
        const resultDetails = document.getElementById('resultDetails');

        if (result.success) {
            resultIcon.textContent = result.critical ? '💥' : '⚡';
            resultText.textContent = '修練成功！';
            resultDetails.textContent = `獲得 ${result.experience} 經驗`;
            
            if (result.levelUp) {
                resultDetails.textContent += `\n🎉 升級到 ${result.levelUp.realm} ${result.levelUp.level}層！`;
            }
        } else {
            resultIcon.textContent = '💔';
            resultText.textContent = '修練失敗';
            resultDetails.textContent = result.message || '修練失敗，請重試';
        }

        resultElement.classList.add('show');
        
        setTimeout(() => {
            resultElement.classList.remove('show');
        }, 3000);
    }

    handleBroadcastMessage(message) {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'cultivation_result':
                    this.showCultivationResult(data.payload);
                    break;
                case 'player_update':
                    this.playerData = data.payload;
                    this.updatePlayerUI();
                    break;
                case 'leaderboard_update':
                    this.leaderboardData = data.payload;
                    this.updateLeaderboardUI();
                    break;
                case 'notification':
                    this.addNotification(data.payload);
                    break;
                default:
                    console.log('未知的廣播訊息類型:', data.type);
            }
        } catch (error) {
            console.error('處理廣播訊息錯誤:', error);
        }
    }

    addNotification(notification) {
        this.notifications.unshift(notification);
        if (this.notifications.length > 3) {
            this.notifications = this.notifications.slice(0, 3);
        }
        this.updateNotificationsUI();
    }

    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.toggle('minimized');
        }
    }

    hidePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'none';
        }
    }

    showPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'block';
        }
    }

    toggleVisibility() {
        const overlay = document.getElementById('videoOverlay');
        this.isHidden = !this.isHidden;
        
        if (this.isHidden) {
            overlay.classList.add('hidden');
            document.getElementById('hideBtn').textContent = '👁️‍🗨️';
        } else {
            overlay.classList.remove('hidden');
            document.getElementById('hideBtn').textContent = '👁️';
        }
    }

    refreshAllData() {
        console.log('刷新所有數據...');
        this.loadPlayerData();
        this.loadLeaderboard();
        this.loadNotifications();
    }

    showSettings() {
        // 實際實現中應該顯示設置面板
        console.log('顯示設置面板');
    }

    setConnectionStatus(connected) {
        this.isConnected = connected;
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = '已連接';
        } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = '連接失敗';
        }
    }

    showLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    startUpdateCycles() {
        // 定期更新玩家數據
        this.intervals.player = setInterval(() => {
            if (this.isConnected && !this.isHidden) {
                this.loadPlayerData();
            }
        }, this.updateIntervals.player);

        // 定期更新排行榜
        this.intervals.leaderboard = setInterval(() => {
            if (this.isConnected && !this.isHidden) {
                this.loadLeaderboard();
            }
        }, this.updateIntervals.leaderboard);

        // 定期更新通知
        this.intervals.notifications = setInterval(() => {
            if (this.isConnected && !this.isHidden) {
                this.loadNotifications();
            }
        }, this.updateIntervals.notifications);
    }

    stopUpdateCycles() {
        Object.values(this.intervals).forEach(intervalId => {
            clearInterval(intervalId);
        });
        this.intervals = {};
    }

    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.auth ? this.auth.token : ''}`
            },
            timeout: 10000
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            return await response.json();
        } catch (error) {
            console.error('API 請求失敗:', error);
            return { success: false, message: error.message };
        }
    }

    getUsernameFromAuth() {
        if (this.auth && this.auth.userId) {
            return this.auth.userId;
        }
        return 'feisheng123'; // 開發模式默認用戶
    }

    formatNumber(num) {
        if (typeof num !== 'number') return '0';
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) { // 1分鐘內
            return '剛剛';
        } else if (diff < 3600000) { // 1小時內
            return Math.floor(diff / 60000) + '分鐘前';
        } else if (diff < 86400000) { // 1天內
            return Math.floor(diff / 3600000) + '小時前';
        } else {
            return date.toLocaleDateString('zh-TW');
        }
    }

    getNotificationIcon(type) {
        const icons = {
            'cultivation': '⚡',
            'breakthrough': '🌟',
            'levelup': '🎉',
            'achievement': '🏆',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️',
            'success': '✅'
        };
        return icons[type] || 'ℹ️';
    }

    // 清理資源
    destroy() {
        this.stopUpdateCycles();
        
        if (this.twitch) {
            this.twitch.unlisten('broadcast', () => {});
        }
        
        console.log('影片元件已銷毀');
    }
}

// 當頁面載入完成時初始化元件
document.addEventListener('DOMContentLoaded', () => {
    window.cultivationVideoComponent = new CultivationVideoComponent();
});

// 當頁面即將關閉時清理資源
window.addEventListener('beforeunload', () => {
    if (window.cultivationVideoComponent) {
        window.cultivationVideoComponent.destroy();
    }
});