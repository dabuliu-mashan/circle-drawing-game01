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

    // 1. 计算半径和角度
    let radii = [];
    let angles = [];
    points.forEach(point => {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        radii.push(radius);
        angles.push(angle);
    });

    // 2. 计算圆度分数（新方法）
    // 2.1 半径一致性评分
    const avgRadius = radii.reduce((a, b) => a + b) / radii.length;
    const radiusVariance = radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / radii.length;
    const radiusStdDev = Math.sqrt(radiusVariance);
    const radiusConsistencyScore = Math.max(0, 100 * (1 - (radiusStdDev / avgRadius) * 2));

    // 2.2 曲率变化评分
    let curvatureScore = 0;
    const minPoints = 4; // 需要至少4个点来计算曲率
    if (points.length >= minPoints) {
        let curvatures = [];
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            // 计算两个向量
            const v1x = curr.x - prev.x;
            const v1y = curr.y - prev.y;
            const v2x = next.x - curr.x;
            const v2y = next.y - curr.y;
            
            // 计算向量夹角
            const dot = v1x * v2x + v1y * v2y;
            const cross = v1x * v2y - v1y * v2x;
            const angle = Math.atan2(cross, dot);
            
            curvatures.push(Math.abs(angle));
        }
        
        // 计算曲率的一致性
        const avgCurvature = curvatures.reduce((a, b) => a + b) / curvatures.length;
        const curvatureVariance = curvatures.reduce((sum, c) => sum + Math.pow(c - avgCurvature, 2), 0) / curvatures.length;
        curvatureScore = Math.max(0, 100 * (1 - Math.sqrt(curvatureVariance) * 2));
    }

    // 2.3 角度分布评分（检测是否为多边形）
    let angleDiffs = [];
    for (let i = 1; i < angles.length; i++) {
        let diff = angles[i] - angles[i-1];
        if (diff < -Math.PI) diff += 2 * Math.PI;
        if (diff > Math.PI) diff -= 2 * Math.PI;
        angleDiffs.push(Math.abs(diff));
    }
    
    // 添加首尾角度差
    let lastDiff = angles[0] - angles[angles.length - 1];
    if (lastDiff < -Math.PI) lastDiff += 2 * Math.PI;
    if (lastDiff > Math.PI) lastDiff -= 2 * Math.PI;
    angleDiffs.push(Math.abs(lastDiff));
    
    // 检测是否存在突变点（多边形的特征）
    const maxAngleDiff = Math.max(...angleDiffs);
    const minAngleDiff = Math.min(...angleDiffs);
    const angleVarianceScore = Math.max(0, 100 * (1 - (maxAngleDiff - minAngleDiff) * 2));

    // 3. 计算闭合度分数
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    const closureDistance = Math.sqrt(
        Math.pow(startPoint.x - endPoint.x, 2) + 
        Math.pow(startPoint.y - endPoint.y, 2)
    );
    const closureScore = Math.max(0, 100 * (1 - closureDistance / (avgRadius * 0.3)));

    // 4. 计算点密度均匀性
    const idealPointCount = Math.ceil(2 * Math.PI * avgRadius / 5); // 每5像素一个点
    const densityScore = Math.max(0, 100 * (1 - Math.abs(points.length - idealPointCount) / idealPointCount));

    // 综合评分
    // 圆度权重提高到70%，其中曲率占35%，半径一致性占20%，角度分布占15%
    score = Math.floor(
        curvatureScore * 0.35 +
        radiusConsistencyScore * 0.20 +
        angleVarianceScore * 0.15 +
        closureScore * 0.20 +
        densityScore * 0.10
    );

    // 如果任何一项得分过低，说明可能是多边形
    if (curvatureScore < 50 || radiusConsistencyScore < 50 || angleVarianceScore < 50) {
        score = Math.min(score, 50);
    }

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