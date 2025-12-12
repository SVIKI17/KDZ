// public/js/main.js

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Инициализация КДЗ');
    
    // Инициализация ripple эффекта
    initRippleButtons();
    
    // Инициализация анимаций прогресса
    initProgressAnimations();
});

// Ripple эффект для кнопок
function initRippleButtons() {
    const buttons = document.querySelectorAll('.btn, .swipe-btn');
    
    buttons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
}

// Создание ripple эффекта
function createRipple(e) {
    const button = e.currentTarget;
    
   
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${e.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add('ripple');
    
 
    const ripple = button.getElementsByClassName('ripple')[0];
    if (ripple) {
        ripple.remove();
    }
    
   
    button.appendChild(circle);
    
    // Удаляем через время
    setTimeout(() => {
        circle.remove();
    }, 600);
}

// Функция для отправки статистики
async function saveStudySession(data) {
    try {
        const response = await fetch('/api/study/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка при сохранении сессии:', error);
        return null;
    }
}

// Функция для отображения уведомлений
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}


function getNotificationIcon(type) {
    const icons = {
        'info': 'info-circle',
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle'
    };
    return icons[type] || 'info-circle';
}

// Инициализация анимаций прогресса
function initProgressAnimations() {
    const progressBars = document.querySelectorAll('.progress-fill');
    
    progressBars.forEach(bar => {
     
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    // Добавляем класс для анимации
                    bar.classList.add('progress-animating');
                    setTimeout(() => {
                        bar.classList.remove('progress-animating');
                    }, 600);
                }
            });
        });
        
        observer.observe(bar, { attributes: true });
    });
}

// Форматирование времени
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Стили для уведомлений и анимаций
const customStyles = document.createElement('style');
customStyles.textContent = `
/* Стили для уведомлений */
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 8px;
    padding: 15px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 300px;
    max-width: 400px;
    z-index: 10000;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    transform: translateX(120%);
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border-left: 4px solid;
}

.notification.show {
    transform: translateX(0);
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.notification i {
    font-size: 1.2rem;
}

.notification-info {
    border-left-color: #2196F3;
    background: #e3f2fd;
}

.notification-info i {
    color: #2196F3;
}

.notification-success {
    border-left-color: #4CAF50;
    background: #e8f5e9;
}

.notification-success i {
    color: #4CAF50;
}

.notification-error {
    border-left-color: #f44336;
    background: #ffebee;
}

.notification-error i {
    color: #f44336;
}

.notification-warning {
    border-left-color: #FF9800;
    background: #fff3e0;
}

.notification-warning i {
    color: #FF9800;
}

.notification button {
    background: none;
    border: none;
    color: #757575;
    font-size: 20px;
    cursor: pointer;
    margin-left: 15px;
}

.notification button:hover {
    color: #424242;
}

/* Анимация прогресс-бара */
.progress-animating {
    animation: progress-fill 0.6s ease-out;
}

@keyframes progress-fill {
    0% { transform: scaleX(0); }
    100% { transform: scaleX(1); }
}

/* Ripple эффект */
.ripple {
    position: absolute;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.7);
    transform: scale(0);
    animation: ripple-animation 0.6s linear;
    pointer-events: none;
}

@keyframes ripple-animation {
    to {
        transform: scale(4);
        opacity: 0;
    }
}

/* Адаптивность уведомлений */
@media (max-width: 768px) {
    .notification {
        left: 20px;
        right: 20px;
        max-width: none;
        transform: translateY(-150%);
    }
    
    .notification.show {
        transform: translateY(0);
    }
}
`;
document.head.appendChild(customStyles);

// Экспорт функций для использования в режимах обучения
window.KDZ = {
    saveStudySession,
    showNotification,
    formatTime,
    createRipple
};