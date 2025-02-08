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
    if (points.length < 20) { // 需要足够多的点才能判断是否为圆形
        score = 0;
        scoreElement.textContent = '得分: 0';
        return;
    }

    // 1. 计算几何中心
    let centerX = 0, centerY = 0;
    points.forEach(point => {
        centerX += point.x;
        centerY += point.y;
    });
    centerX /= points.length;
    centerY /= points.length;

    // 2. 计算到中心的距离（半径）
    let radii = points.map(point => {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        return Math.sqrt(dx * dx + dy * dy);
    });

    // 3. 计算平均半径和标准差
    const avgRadius = radii.reduce((a, b) => a + b) / radii.length;
    const radiusVariance = radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / radii.length;
    const radiusStdDev = Math.sqrt(radiusVariance);
    
    // 4. 计算角度序列
    let angles = points.map(point => {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        return Math.atan2(dy, dx);
    });

    // 5. 检测多边形特征
    // 5.1 计算角度变化率
    let angleChanges = [];
    for (let i = 1; i < angles.length; i++) {
        let change = angles[i] - angles[i-1];
        if (change < -Math.PI) change += 2 * Math.PI;
        if (change > Math.PI) change -= 2 * Math.PI;
        angleChanges.push(Math.abs(change));
    }

    // 5.2 检测角点（突变点）
    const avgAngleChange = angleChanges.reduce((a, b) => a + b) / angleChanges.length;
    const maxAngleChange = Math.max(...angleChanges);
    const minAngleChange = Math.min(...angleChanges);
    const angleChangeRatio = maxAngleChange / (minAngleChange || 0.001);

    // 6. 计算曲率一致性
    let curvatures = [];
    for (let i = 2; i < points.length - 2; i++) {
        const p1 = points[i - 2];
        const p2 = points[i - 1];
        const p3 = points[i];
        const p4 = points[i + 1];
        const p5 = points[i + 2];

        // 计算连续三点的曲率
        const k1 = calculateLocalCurvature(p1, p2, p3);
        const k2 = calculateLocalCurvature(p2, p3, p4);
        const k3 = calculateLocalCurvature(p3, p4, p5);

        curvatures.push(Math.abs(k2));
    }

    // 7. 判断是否为多边形或异形
    const isPolygon = 
        angleChangeRatio > 3 || // 存在明显的角点
        radiusStdDev / avgRadius > 0.1 || // 半径变化太大
        maxAngleChange > Math.PI / 4; // 存在锐角

    if (isPolygon) {
        score = 0;
        scoreElement.textContent = '得分: 0 (非圆形)';
        return;
    }

    // 8. 圆形评分（仅在通过多边形检测后）
    // 8.1 半径一致性得分 (40%)
    const radiusScore = Math.max(0, 100 * (1 - (radiusStdDev / avgRadius) * 5));

    // 8.2 曲率一致性得分 (40%)
    const avgCurvature = curvatures.reduce((a, b) => a + b) / curvatures.length;
    const curvatureVariance = curvatures.reduce((sum, c) => sum + Math.pow(c - avgCurvature, 2), 0) / curvatures.length;
    const curvatureScore = Math.max(0, 100 * (1 - Math.sqrt(curvatureVariance) * 5));

    // 8.3 闭合性得分 (20%)
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    const closureDistance = Math.sqrt(
        Math.pow(startPoint.x - endPoint.x, 2) + 
        Math.pow(startPoint.y - endPoint.y, 2)
    );
    const closureScore = Math.max(0, 100 * (1 - closureDistance / (avgRadius * 0.2)));

    // 9. 最终评分
    score = Math.floor(
        radiusScore * 0.4 +
        curvatureScore * 0.4 +
        closureScore * 0.2
    );

    // 10. 额外的严格性检查
    if (radiusScore < 70 || curvatureScore < 70) {
        score = Math.min(score, 60); // 如果基本特征不够好，限制最高分
    }

    score = Math.max(0, Math.min(100, score));
    scoreElement.textContent = `得分: ${score}`;
    
    if (score > 0) {
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        addScore(score, dateStr);
    }
}

// 计算局部曲率的辅助函数
function calculateLocalCurvature(p1, p2, p3) {
    const a = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const b = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));
    const c = Math.sqrt(Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2));
    
    // 使用海伦公式计算面积
    const s = (a + b + c) / 2;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    
    // 曲率 = 4 * 面积 / (a * b * c)
    return 4 * area / (a * b * c);
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