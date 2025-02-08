const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const goButton = document.getElementById('go-button');
const goText = document.getElementById('go-text');
const refreshButton = document.getElementById('refresh-button');
const leaderboardButton = document.getElementById('leaderboard-button');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeModalButton = document.getElementById('close-modal');
const leaderboardContent = document.getElementById('leaderboard-content');

let drawing = false;
let canDraw = true;  // 新增：控制是否可以画图
let points = [];
let score = 0;

// 初始化
initCanvas();
initLeaderboard();
loadLeaderboard();  // 加载排行榜

// 设置canvas的实际尺寸
function initCanvas() {
    canvas.width = 300;
    canvas.height = 300;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
}

// 获取鼠标在canvas上的实际位置
function getMousePos(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX || event.pageX) - rect.left;
    const y = (event.clientY || event.pageY) - rect.top;
    return { x, y };
}

// 添加触摸事件支持
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd);

function handleTouchStart(event) {
    event.preventDefault();
    if (!canDraw) return;
    
    const touch = event.touches[0];
    const pos = getMousePos(canvas, touch);
    drawing = true;
    points = [];
    points.push(pos);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function handleTouchMove(event) {
    event.preventDefault();
    if (!drawing || !canDraw) return;
    
    const touch = event.touches[0];
    const pos = getMousePos(canvas, touch);
    points.push(pos);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
}

function handleTouchEnd(event) {
    event.preventDefault();
    if (!drawing || !canDraw) return;
    drawing = false;
    canDraw = false;
    calculateScore();
}

refreshButton.addEventListener('click', () => {
    clearCanvas();
    canDraw = true;  // 重新开始后允许画图
});

// 排行榜按钮事件
leaderboardButton.addEventListener('click', () => {
    leaderboardModal.classList.remove('hidden');
    loadLeaderboard();  // 更新显示排行榜
});

closeModalButton.addEventListener('click', () => {
    leaderboardModal.classList.add('hidden');
});

goButton.addEventListener('click', () => {
    goButton.classList.add('hidden');
    setTimeout(() => {
        goButton.style.display = 'none';
        goText.classList.remove('hidden');
        goText.classList.add('show');
        setTimeout(() => {
            goText.classList.remove('show');
            goText.classList.add('hidden');
        }, 500);
    }, 500);
});

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    scoreElement.textContent = '得分: 0';
    points = [];
    score = 0;
}

function calculateScore() {
    if (points.length < 3) {
        score = 0;
        scoreElement.textContent = '得分: 0';
        return;
    }

    // 计算中心点
    let centerX = 0, centerY = 0;
    points.forEach(point => {
        centerX += point.x;
        centerY += point.y;
    });
    centerX /= points.length;
    centerY /= points.length;

    // 计算平均半径
    let radii = points.map(point => {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        return Math.sqrt(dx * dx + dy * dy);
    });

    const avgRadius = radii.reduce((a, b) => a + b) / radii.length;

    // 1. 计算圆度分数（基于半径的一致性）
    const radiusVariance = radii.reduce((sum, r) => sum + Math.abs(r - avgRadius), 0) / radii.length;
    const radiusConsistencyScore = Math.max(0, 100 * (1 - radiusVariance / avgRadius));

    // 2. 计算点分布均匀性
    let angles = points.map(point => {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        return Math.atan2(dy, dx);
    });
    
    // 确保角度都是正值（0到2π）
    angles = angles.map(angle => angle < 0 ? angle + 2 * Math.PI : angle);
    
    // 计算相邻点之间的角度差
    let angleDiffs = [];
    for (let i = 1; i < angles.length; i++) {
        let diff = angles[i] - angles[i-1];
        if (diff < 0) diff += 2 * Math.PI;
        angleDiffs.push(diff);
    }
    
    // 计算角度分布的均匀性
    const avgAngleDiff = (2 * Math.PI) / angles.length;
    const angleVariance = angleDiffs.reduce((sum, diff) => 
        sum + Math.abs(diff - avgAngleDiff), 0) / angleDiffs.length;
    const distributionScore = Math.max(0, 100 * (1 - angleVariance / avgAngleDiff));

    // 3. 计算闭合度分数
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    const closureDistance = Math.sqrt(
        Math.pow(startPoint.x - endPoint.x, 2) + 
        Math.pow(startPoint.y - endPoint.y, 2)
    );
    const closureScore = Math.max(0, 100 * (1 - closureDistance / (avgRadius * 0.5)));

    // 综合评分：
    // - 圆度（半径一致性）: 60%
    // - 点分布均匀性: 30%
    // - 闭合度: 10%
    score = Math.floor(
        radiusConsistencyScore * 0.6 +
        distributionScore * 0.3 +
        closureScore * 0.1
    );

    // 确保分数在0-100之间
    score = Math.max(0, Math.min(100, score));
    scoreElement.textContent = `得分: ${score}`;
    
    if (score > 0) {
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        addScore(score, dateStr);
    }
}

function addScore(newScore, date) {
    // 获取现有分数记录
    let scores = JSON.parse(localStorage.getItem('scores')) || [];
    
    // 添加新分数记录
    const scoreRecord = {
        score: parseInt(newScore),  // 确保分数是整数
        date: date
    };
    
    // 检查是否应该添加到排行榜
    const shouldAdd = scores.length < 5 || scoreRecord.score > (scores[scores.length - 1]?.score || 0);
    
    if (shouldAdd) {
        // 添加新记录
        scores.push(scoreRecord);
        
        // 按分数从高到低排序
        scores.sort((a, b) => b.score - a.score);
        
        // 只保留前5个最高分
        scores = scores.slice(0, 5);
        
        // 保存到localStorage
        try {
            localStorage.setItem('scores', JSON.stringify(scores));
        } catch (e) {
            console.error('保存分数失败:', e);
        }
    }
    
    // 更新显示
    loadLeaderboard();
}

function loadLeaderboard() {
    try {
        const scores = JSON.parse(localStorage.getItem('scores')) || [];
        
        if (!scores || scores.length === 0) {
            leaderboardContent.innerHTML = '<div style="text-align: center; padding: 20px;">暂无记录</div>';
            return;
        }
        
        // 生成排行榜HTML
        const leaderboardHTML = scores
            .map((item, index) => {
                if (!item || typeof item.score === 'undefined') return '';
                return `<div style="margin: 10px 0;">第${index + 1}名: ${item.score}分 (${item.date})</div>`;
            })
            .filter(item => item !== '')  // 移除空记录
            .join('');
        
        leaderboardContent.innerHTML = leaderboardHTML || '<div style="text-align: center; padding: 20px;">暂无记录</div>';
    } catch (e) {
        console.error('加载排行榜失败:', e);
        leaderboardContent.innerHTML = '<div style="text-align: center; padding: 20px;">暂无记录</div>';
    }
}

function initLeaderboard() {
    try {
        localStorage.removeItem('scores');
        localStorage.setItem('scores', JSON.stringify([]));
        loadLeaderboard();
    } catch (e) {
        console.error('初始化排行榜失败:', e);
    }
}

// 在页面加载时初始化排行榜
// initLeaderboard(); // 如果需要清空排行榜，取消这行的注释 