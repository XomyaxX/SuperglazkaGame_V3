#!/usr/bin/env python3
import json
from pathlib import Path

locales_dir = Path('locales')

# New keys to add (key -> ru value)
new_keys = {
    "nav.home": "Главная",
    "nav.checklist": "Чек-лист",
    "app.continueAdventure": "Продолжить приключение",
    "app.continue": "Продолжить",
    "app.nextChapterSoon": "До новой главы",
    "app.comingSoon": "Скоро!",
    "time.days": "дней",
    "time.hours": "часов",
    "time.minutes": "минут",
    "time.seconds": "секунд",
    "app.showSubtitles": "Показывать субтитры",
    "app.subtitleFontSize": "Размер шрифта субтитров",
    "app.help": "❓ Помощь",
    "faq.controls.question": "Как управлять?",
    "faq.controls.answer": "На компьютере: используйте стрелки вверх/вниз или клавишу Пробел для перехода к следующему кадру. Клавиша Esc скрывает/показывает интерфейс.",
    "faq.controls.answer2": "На телефоне: свайпайте вверх/вниз для переключения кадров. Тап по экрану ставит видео на паузу.",
    "faq.sound.question": "Что делать, если звук не работает?",
    "faq.sound.answer": "1. Проверьте, что в настройках включены нужные аудиотреки. 2. На iOS звук включается только после первого касания экрана пользователем — это ограничение Safari. 3. Проверьте громкость устройства и не включён ли беззвучный режим. 4. Перезагрузите страницу — иногда браузер блокирует автовоспроизведение.",
    "faq.coins.question": "Как заработать монеты?",
    "faq.coins.answer": "Монеты начисляются за прохождение кадров и мини-игр. Чем лучше результат в игре (больше звёзд), тем больше монет. Также можно получить бонусные монеты за повторное прохождение главы.",
    "faq.locked.question": "Почему глава заблокирована?",
    "faq.locked.answer": "Главы открываются последовательно. Чтобы разблокировать следующую главу, нужно досмотреть предыдущую до конца. Прогресс сохраняется автоматически.",
    "faq.subtitles.question": "Как включить субтитры?",
    "faq.subtitles.answer": "Откройте настройки → раздел «Субтитры» → переключите тумблер. Там же можно выбрать размер шрифта: маленький, средний или большой.",
    "faq.theme.question": "Как поменять тему?",
    "faq.theme.answer": "В настройках → раздел «Интерфейс» → переключатель «Тёмная тема». Выбор сохраняется и работает на обеих страницах.",
    "app.showFullText": "Показать полностью",
    "app.miniGames": "🎮 Мини-игры",
    "app.miniGame": "Мини-игра!",
    "app.tapToPlay": "Нажми, чтобы сыграть",
    "app.play": "Играть",
    "app.back": "◀ Назад",
    "app.next": "Далее ▶",
    "app.getReady": "Готовься к испытанию...",
    "app.playGame": "Играть! 🚀",
    "games.runner.intro": "Помоги Суперглазке догнать Пикселька на столе! Уворачивайся от посуды.",
    "games.runner.completed": "🏃 Погоня завершена!",
    "games.stats.lives": "❤️ Жизни",
    "games.stats.livesLeft": "Осталось жизней:",
    "games.stats.bonuses": "💎 Бонусы",
    "games.stats.collected": "Собрано:",
    "games.stats.result": "🎯 Результат",
    "games.stats.distance": "Дистанция:",
    "games.stats.status": "Статус:",
    "games.stats.victory": "Победа!",
    "games.stats.rating": "🏆 Оценка: ⭐⭐⭐",
    "auth.joinTeam": "🌟 Стань частью команды!",
    "auth.joinBenefits": "Зарегистрируйся, чтобы: Сохранить свой прогресс, Получать награды за победы, Открыть следующую серию комикса, Участвовать в соревнованиях",
    "auth.nicknamePlaceholder": "Придумай никнейм",
    "auth.parentEmailPlaceholder": "Email родителя",
    "auth.parentsAllowed": "Родители разрешили играть",
    "auth.registerBtn": "🚀 Зарегистрироваться",
    "auth.skipRegistration": "Продолжить без регистрации →",
    "games.gym.title": "Ваня против Ленивуса!",
    "games.gym.intro": "Помоги Ване победить Ленивуса! Используй три супер-атаки: Лазер, Прицел и Слёзы.",
    "app.fight": "В бой! 🚀",
    "games.gym.bossName": "👁️ ЛЕНИВУС",
    "games.gym.rays": "Лучики",
    "app.skip": "Пропустить ▸",
    "app.great": "Отлично!",
    "app.youDidIt": "Ты справился! Продолжение в комиксе...",
    "app.greatJob": "🎉 Отличная работа!",
    "games.gym.ray": "⚡ Солнечный Луч",
    "games.stats.hits": "Попаданий:",
    "games.stats.accuracy": "Точность:",
    "games.gym.scope": "🎯 Точный Прицел",
    "games.stats.avgTime": "Среднее время наведения:",
    "games.gym.tears": "💧 Слезный Водопад",
    "games.stats.waterfalls": "Водопадов:",
    "games.stats.totalBlinks": "Всего морганий:",
    "games.stats.totalScore": "🏆 Общий счёт: 0",
    "auth.joinBenefitsGym": "Зарегистрируйся, чтобы: Сохранить свой прогресс, Получать награды за тренировки, Открыть следующую серию комикса, Участвовать в соревнованиях",
    "app.chapters": "📖 Главы",
    "app.account": "🔐 Аккаунт",
    "app.notifications": "🔔 Уведомления",
    "app.yourEmail": "Твой email",
    "app.subscribe": "Подписаться на новые главы",
    "brand.subtitle": "Игросказка",
    "auth.quickStart": "Быстрый старт",
    "auth.fullAccount": "Полный аккаунт",
    "auth.guestDesc": "Введи никнейм и начни играть. Прогресс сохранится, но монетки пока нельзя тратить.",
    "auth.yourNickname": "Твой никнейм",
    "auth.play": "🚀 Играть!",
    "auth.nickname": "Никнейм",
    "auth.parentEmail": "Email родителя",
    "auth.phoneOptional": "Телефон (необязательно)",
    "auth.passwordMin6": "Пароль (минимум 6 символов)",
    "auth.haveAccount": "Уже есть аккаунт?",
    "auth.login": "Войти",
    "auth.password": "Пароль",
    "auth.loginBtn": "🔑 Войти",
    "auth.noAccount": "Нет аккаунта?",
    "auth.register": "Зарегистрироваться",
    "games.blink.round": "Раунд",
    "games.blink.time": "Время",
    "games.blink.hint": "Кликай по экрану, чтобы моргать!",
    "app.wellDone": "Молодец!",
    "games.blink.win": "Глаза в порядке! +100 🪙",
    "games.tracker.phase": "Фаза",
    "games.tracker.hint": "Следи за шариком глазами 👀",
    "games.tracker.win": "Глаза отдохнули! +100 🪙",
    "app.nextFrame": "Следующий кадр...",
    "cookie.text": "Мы используем localStorage для сохранения прогресса и настроек.",
    "cookie.privacy": "Политика конфиденциальности",
    "cookie.accept": "Принять",
    "footer.text": "Сделано с ❤️ для защиты зрения детей · Суперглазка · 2025",
}

# Keys to remove (junk from previous script run)
remove_keys = [
    "title", "land_logo", "checklist_back", "checklist_content",
    "checklist_subtitle", "progresstext", "checklist_card", "checklist_item",
    "checklist_print_btn", "resetbtn", "land_footer", "cookiebanner",
    "cookieaccept", "land_logo_pretitle", "land_logo_title"
]

def flatten(d, parent=''):
    items = {}
    for k, v in d.items():
        key = f"{parent}.{k}" if parent else k
        if isinstance(v, dict):
            items.update(flatten(v, key))
        else:
            items[key] = v
    return items

def unflatten(d):
    result = {}
    for key, value in d.items():
        parts = key.split('.')
        target = result
        for part in parts[:-1]:
            if part not in target:
                target[part] = {}
            target = target[part]
        target[parts[-1]] = value
    return result

for lang in ['ru', 'en', 'kz']:
    path = locales_dir / f"{lang}.json"
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    flat = flatten(data)
    
    # Remove junk keys
    for key in remove_keys:
        if key in flat:
            del flat[key]
    
    # Add new keys
    for key, ru_val in new_keys.items():
        if key not in flat:
            if lang == 'ru':
                flat[key] = ru_val
            else:
                flat[key] = ''  # Empty for translators
    
    data = unflatten(flat)
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Updated {path}")
