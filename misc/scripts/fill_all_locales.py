#!/usr/bin/env python3
"""Fill all empty keys in en.json, kz.json, zh.json and add JS keys."""
import json
from pathlib import Path

locales_dir = Path('locales')

def flatten(d, p=''):
    items = {}
    for k, v in d.items():
        key = p + '.' + k if p else k
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

# Load ru as source of truth
with open(locales_dir / 'ru.json', 'r', encoding='utf-8') as f:
    ru_flat = flatten(json.load(f))

# Junk keys to remove (from previous script artifacts)
junk_prefixes = [
    'checklist_back.', 'checklist_card.', 'checklist_content.',
    'checklist_item.', 'checklist_print_btn.', 'checklist_subtitle.',
    'land_footer.', 'land_logo.', 'land_logo_pretitle.', 'land_logo_title.',
    'progresstext.', 'resetbtn.', 'title.', 'cookieaccept.', 'cookiebanner.',
]

def is_junk(key):
    return any(key.startswith(p) for p in junk_prefixes)

# Remove junk from ru.json too
for key in list(ru_flat.keys()):
    if is_junk(key):
        del ru_flat[key]

# Translation dictionaries for empty keys
en_translations = {
    "app.account": "🔐 Account",
    "app.chapters": "📖 Chapters",
    "app.comingSoon": "Coming soon!",
    "app.continue": "Continue",
    "app.continueAdventure": "Continue adventure",
    "app.fight": "Fight! 🚀",
    "app.getReady": "Get ready for the challenge...",
    "app.great": "Great!",
    "app.greatJob": "🎉 Great job!",
    "app.help": "❓ Help",
    "app.miniGame": "Mini-game!",
    "app.miniGames": "🎮 Mini-games",
    "app.next": "Next ▶",
    "app.nextChapterSoon": "Next chapter soon",
    "app.nextFrame": "Next frame...",
    "app.notifications": "🔔 Notifications",
    "app.play": "Play",
    "app.playGame": "Play! 🚀",
    "app.showFullText": "Show full text",
    "app.showSubtitles": "Show subtitles",
    "app.skip": "Skip ▸",
    "app.subscribe": "Subscribe to new chapters",
    "app.subtitleFontSize": "Subtitle font size",
    "app.tapToPlay": "Tap to play",
    "app.wellDone": "Well done!",
    "app.youDidIt": "You did it!\nContinued in the comic...",
    "app.yourEmail": "Your email",
    "auth.fullAccount": "Full account",
    "auth.guestDesc": "Enter a nickname and start playing. Progress will be saved, but coins can't be spent yet.",
    "auth.haveAccount": "Already have an account?",
    "auth.joinBenefits": "Sign up to: save your progress, get victory rewards, unlock the next comic series, compete with others",
    "auth.joinBenefitsGym": "Sign up to: save your progress, get training rewards, unlock the next comic series, compete with others",
    "auth.joinTeam": "🌟 Join the team!",
    "auth.loginBtn": "🔑 Login",
    "auth.nicknamePlaceholder": "Choose a nickname",
    "auth.noAccount": "No account?",
    "auth.parentEmail": "Parent's email",
    "auth.parentEmailPlaceholder": "Parent's email",
    "auth.parentsAllowed": "Parents allowed to play",
    "auth.passwordMin6": "Password (min 6 characters)",
    "auth.phoneOptional": "Phone (optional)",
    "auth.play": "🚀 Play!",
    "auth.registerBtn": "🚀 Register",
    "auth.skipRegistration": "Continue without registration →",
    "auth.yourNickname": "Your nickname",
    "brand.subtitle": "Game Tale",
    "cookie.accept": "Accept",
    "cookie.privacy": "Privacy Policy",
    "cookie.text": "We use localStorage to save progress and settings.",
    "faq.coins.answer": "Coins are awarded for completing frames and mini-games. The better the game result (more stars), the more coins. You can also get bonus coins for replaying a chapter.",
    "faq.coins.question": "How to earn coins?",
    "faq.controls.answer": "On computer: use up/down arrows or Space key to go to the next frame. Esc key hides/shows the interface.",
    "faq.controls.answer2": "On phone: swipe up/down to switch frames. Tap the screen to pause the video.",
    "faq.controls.question": "How to control?",
    "faq.locked.answer": "Chapters open sequentially. To unlock the next chapter, you need to finish watching the previous one. Progress is saved automatically.",
    "faq.locked.question": "Why is the chapter locked?",
    "faq.sound.answer": "1. Check that the required audio tracks are enabled in settings. 2. On iOS, sound only turns on after the user's first touch — this is a Safari limitation. 3. Check the device volume and whether silent mode is on. 4. Reload the page — sometimes the browser blocks autoplay.",
    "faq.sound.question": "What to do if sound doesn't work?",
    "faq.subtitles.answer": "Open settings → 'Subtitles' section → toggle the switch. You can also choose font size: small, medium or large.",
    "faq.subtitles.question": "How to turn on subtitles?",
    "faq.theme.answer": "In settings → 'Interface' section → 'Dark theme' toggle. The choice is saved and works on both pages.",
    "faq.theme.question": "How to change theme?",
    "games.blink.hint": "Click on the screen to blink!",
    "games.blink.round": "Round",
    "games.blink.time": "Time",
    "games.gym.bossName": "👁️ LENIVUS",
    "games.gym.intro": "Help Vanya defeat Lenivus! Use three super-attacks: Laser, Aim and Tears.",
    "games.gym.ray": "⚡ Sun Ray",
    "games.gym.rays": "Rays",
    "games.gym.scope": "🎯 Precise Aim",
    "games.gym.tears": "💧 Tear Waterfall",
    "games.runner.completed": "🏃 Chase completed!",
    "games.runner.intro": "Help Superglazka catch Pixelko on the table! Dodge the dishes.",
    "games.stats.accuracy": "Accuracy:",
    "games.stats.avgTime": "Average aiming time:",
    "games.stats.bonuses": "💎 Bonuses",
    "games.stats.collected": "Collected:",
    "games.stats.distance": "Distance:",
    "games.stats.hits": "Hits:",
    "games.stats.lives": "❤️ Lives",
    "games.stats.livesLeft": "Lives left:",
    "games.stats.rating": "🏆 Rating: ⭐⭐⭐",
    "games.stats.result": "🎯 Result",
    "games.stats.status": "Status:",
    "games.stats.totalBlinks": "Total blinks:",
    "games.stats.totalScore": "🏆 Total score: 0",
    "games.stats.victory": "Victory!",
    "games.stats.waterfalls": "Waterfalls:",
    "games.tracker.hint": "Follow the ball with your eyes 👀",
    "games.tracker.phase": "Phase",
    "nav.checklist": "Checklist",
    "nav.home": "Home",
    "time.days": "days",
    "time.hours": "hours",
    "time.minutes": "minutes",
    "time.seconds": "seconds",
    # JS keys
    "app.back": "◀ Back",
    "app.audio": "🎵 Audio",
    "app.narrator": "Narrator",
    "app.bgMusic": "Background music",
    "app.subtitles": "💬 Subtitles",
    "app.accessibility": "♿ Accessibility",
    "app.interface": "🖥️ Interface",
    "app.highContrast": "High contrast",
    "app.reduceMotion": "Reduce motion",
    "app.textSize": "Text size",
    "app.darkTheme": "Dark theme",
    "games.blink.win": "Eyes are fine!\n+100 🪙",
    "games.tracker.win": "Eyes rested!\n+100 🪙",
    "games.runner.level": "Lv.",
    "games.gym.title": "Vanya vs Lenivus!",
    "games.blink.name": "Blink-charge",
    "games.tracker.name": "Tracker-gaze",
    "characters.hrust": "Wise Crystal",
    "characters.sovet": "Advisor",
    "characters.dev": "Girl",
    "characters.tolpa": "Crowd",
    "characters.nar": "Narrator",
    "player.defaultNickname": "Player",
    "player.guestText": "You are playing as a guest. Progress is saved, but coins cannot be spent yet.",
    "player.createAccount": "🔐 Create full account",
    "player.login": "🔑 Already have an account? Login",
    "player.enterLogin": "🔑 Login / Register",
    "player.logout": "🚪 Logout",
    "games.blink.miss": "Miss! Try again",
    "games.blink.timeUp": "Time's up! Try again.",
    "games.blink.releaseEarly": "Released too early! Starting over.",
    "games.blink.hintRound1": "Click on the screen to blink! 8 times in 5 seconds!",
    "games.blink.hintRound2": "Hold mouse button / tap and hold for 3 seconds!",
    "games.blink.hintRound3": "Click when the bar is in the green zone!",
    "games.tracker.hintUpDown": "Follow the ball up and down 👆👇",
    "games.tracker.hintLeftRight": "Follow the ball left and right 👈👉",
    "games.tracker.hintClockwise": "Follow the ball clockwise ⭕",
    "games.tracker.hintCounterClockwise": "Follow the ball counter-clockwise 🔄",
    "games.tracker.getReady": "Get ready...",
    "achievements.unlocked": "🏆 Achievement unlocked!",
    "achievements.title": "Achievements",
}

kz_translations = {
    "app.account": "🔐 Аккаунт",
    "app.chapters": "📖 Тараулар",
    "app.comingSoon": "Жақында!",
    "app.continue": "Жалғастыру",
    "app.continueAdventure": "Шытырмандықты жалғастыру",
    "app.fight": "Шайқасқа! 🚀",
    "app.getReady": "Сынаққа дайындал...",
    "app.great": "Керемет!",
    "app.greatJob": "🎉 Керемет жұмыс!",
    "app.help": "❓ Көмек",
    "app.miniGame": "Мини-ойын!",
    "app.miniGames": "🎮 Мини-ойындар",
    "app.next": "Келесі ▶",
    "app.nextChapterSoon": "Келесі тарауға дейін",
    "app.nextFrame": "Келесі кадр...",
    "app.notifications": "🔔 Хабарламалар",
    "app.play": "Ойнау",
    "app.playGame": "Ойнау! 🚀",
    "app.showFullText": "Толық мәтінді көрсету",
    "app.showSubtitles": "Субтитрлерді көрсету",
    "app.skip": "Өткізіп жіберу ▸",
    "app.subscribe": "Жаңа тарауларға жазылу",
    "app.subtitleFontSize": "Субтитр қаріп өлшемі",
    "app.tapToPlay": "Ойнау үшін басыңыз",
    "app.wellDone": "Жарайсың!",
    "app.youDidIt": "Сен мақсатыңа жеттің!\nКомиксте жалғасы...",
    "app.yourEmail": "Сіздің email",
    "auth.fullAccount": "Толық аккаунт",
    "auth.guestDesc": "Лақап ат енгізіп, ойнауды бастаңыз. Прогресс сақталады, бірақ тиындарды әлі жұмсау мүмкін емес.",
    "auth.haveAccount": "Аккаунтыңыз бар ма?",
    "auth.joinBenefits": "Тіркеліңіз: прогрессіңізді сақтаңыз, жеңіс сыйлықтарын алыңыз, комикстің келесі сериясын ашыңыз, жарыстарға қатысыңыз",
    "auth.joinBenefitsGym": "Тіркеліңіз: прогрессіңізді сақтаңыз, жаттығу сыйлықтарын алыңыз, комикстің келесі сериясын ашыңыз, жарыстарға қатысыңыз",
    "auth.joinTeam": "🌟 Команданың бөлігі бол!",
    "auth.loginBtn": "🔑 Кіру",
    "auth.nicknamePlaceholder": "Лақап ат ойлап табыңыз",
    "auth.noAccount": "Аккаунт жоқ па?",
    "auth.parentEmail": "Ата-ананың email",
    "auth.parentEmailPlaceholder": "Ата-ананың email",
    "auth.parentsAllowed": "Ата-аналар ойнауға рұқсат берді",
    "auth.passwordMin6": "Құпия сөз (кемінде 6 таңба)",
    "auth.phoneOptional": "Телефон (міндетті емес)",
    "auth.play": "🚀 Ойнау!",
    "auth.registerBtn": "🚀 Тіркелу",
    "auth.skipRegistration": "Тіркелмей жалғастыру →",
    "auth.yourNickname": "Сіздің лақап атыңыз",
    "brand.subtitle": "Ойын ертегісі",
    "cookie.accept": "Қабылдау",
    "cookie.privacy": "Құпиялылық саясаты",
    "cookie.text": "Біз прогресс пен параметрлерді сақтау үшін localStorage қолданамыз.",
    "faq.coins.answer": "Кадрлар мен мини-ойындарды өткені үшін тиындар беріледі. Ойын нәтижесі неғұрлым жақсы болса (көбірек жұлдыз), соғұрлым көп тиын. Тарауды қайта өту арқылы бонустық тиындарды алуға болады.",
    "faq.coins.question": "Тиындарды қалай табуға болады?",
    "faq.controls.answer": "Компьютерде: жоғары/төмен көрсеткіштерді немесе келесі кадрға өту үшін Бос орын пернесін пайдаланыңыз. Esc пернесі интерфейсті жасырады/көрсетеді.",
    "faq.controls.answer2": "Телефонда: кадрларды ауыстыру үшін жоғары/төмен сырғытыңыз. Экранды басу видеоны кідіртеді.",
    "faq.controls.question": "Басқару қалай жұмыс істейді?",
    "faq.locked.answer": "Тараулар ретпен ашылады. Келесі тарауды ашу үшін алдыңғысын соңына дейін қарау керек. Прогресс автоматты түрде сақталады.",
    "faq.locked.question": "Неге тарау бұғатталған?",
    "faq.sound.answer": "1. Параметрлерде қажетті аудио тректердің қосылғанын тексеріңіз. 2. iOS-та дыбыс тек пайдаланушының алғашқы қосқаннан кейін ғана қосылады — бұл Safari шектеуі. 3. Құрылғы дыбысын және дыбыссыз режим қосылғанын тексеріңіз. 4. Бетті қайта жүктеңіз — кейде браузер автоматты ойнатуды бұғадайды.",
    "faq.sound.question": "Егер дыбыс жұмыс істемесе не істеу керек?",
    "faq.subtitles.answer": "Параметрлерді ашыңыз → 'Субтитрлер' бөлімі → ауыстыруышты қосыңыз. Сондай-ақ қаріп өлшемін таңдауға болады: кішкентай, орташа немесе үлкен.",
    "faq.subtitles.question": "Субтитрлерді қалай қосуға болады?",
    "faq.theme.answer": "Параметрлерде → 'Интерфейс' бөлімі → 'Қараңғы тақырып' ауыстыруышы. Таңдау сақталады және екі бетте де жұмыс істейді.",
    "faq.theme.question": "Тақырыпты қалай өзгертуге болады?",
    "games.blink.hint": "Көзді қысу үшін экранды басыңыз!",
    "games.blink.round": "Раунд",
    "games.blink.time": "Уақыт",
    "games.gym.bossName": "👁️ ЛЕНИВУС",
    "games.gym.intro": "Ваняға Ленивусты жеңуге көмектес! Үш супер шабуылды қолдан: Лазер, Нысана және Көз жасы.",
    "games.gym.ray": "⚡ Күн Сәулесі",
    "games.gym.rays": "Сәулелер",
    "games.gym.scope": "🎯 Дәл Нысана",
    "games.gym.tears": "💧 Көз Жасы Сарқырамасы",
    "games.runner.completed": "🏃 Қуғынды аяқталды!",
    "games.runner.intro": "Суперглазкаға үстел үстінде Пиксельконы ұстауға көмектес! Ас үй ыдыстарынан қаш.",
    "games.stats.accuracy": "Дәлдік:",
    "games.stats.avgTime": "Нысанаға қоюдың орташа уақыты:",
    "games.stats.bonuses": "💎 Бонустар",
    "games.stats.collected": "Жиналған:",
    "games.stats.distance": "Қашықтық:",
    "games.stats.hits": "Траптар:",
    "games.stats.lives": "❤️ Өмірлер",
    "games.stats.livesLeft": "Қалған өмірлер:",
    "games.stats.rating": "🏆 Бағалау: ⭐⭐⭐",
    "games.stats.result": "🎯 Нәтиже",
    "games.stats.status": "Күй:",
    "games.stats.totalBlinks": "Жалпы қысулар:",
    "games.stats.totalScore": "🏆 Жалпы ұпай: 0",
    "games.stats.victory": "Жеңіс!",
    "games.stats.waterfalls": "Сарқырамалар:",
    "games.tracker.hint": "Көзбен допты қадағала 👀",
    "games.tracker.phase": "Фаза",
    "nav.checklist": "Тексеру тізімі",
    "nav.home": "Басты бет",
    "time.days": "күн",
    "time.hours": "сағат",
    "time.minutes": "минут",
    "time.seconds": "секунд",
    "app.back": "◀ Артқа",
    "app.audio": "🎵 Аудио",
    "app.narrator": "Аңгымеші",
    "app.bgMusic": "Фондық музыка",
    "app.subtitles": "💬 Субтитрлер",
    "app.accessibility": "♿ Қолжетімділік",
    "app.interface": "🖥️ Интерфейс",
    "app.highContrast": "Жоғары контраст",
    "app.reduceMotion": "Анимацияны азайту",
    "app.textSize": "Мәтін өлшемі",
    "app.darkTheme": "Қараңғы тақырып",
    "games.blink.win": "Көздер жақсы жағдайда!\n+100 🪙",
    "games.tracker.win": "Көздер дем алды!\n+100 🪙",
    "games.runner.level": "Дең.",
    "games.gym.title": "Ваня vs Ленивус!",
    "games.blink.name": "Қысу-зарядка",
    "games.tracker.name": "Қадағалау-көз",
    "characters.hrust": "Дана Кристалл",
    "characters.sovet": "Кеңесші",
    "characters.dev": "Қыз",
    "characters.tolpa": "Көпшілік",
    "characters.nar": "Аңгымеші",
    "player.defaultNickname": "Ойыншы",
    "player.guestText": "Сіз қонақ ретінде ойнайсыз. Прогресс сақталады, бірақ тиындарды әлі жұмсау мүмкін емес.",
    "player.createAccount": "🔐 Толық аккаунт жасау",
    "player.login": "🔑 Аккаунтыңыз бар ма? Кіру",
    "player.enterLogin": "🔑 Кіру / Тіркелу",
    "player.logout": "🚪 Шығу",
    "games.blink.miss": "Қолайсыз! Қайта көріңіз",
    "games.blink.timeUp": "Уақыт аяқталды! Қайта байқап көріңіз.",
    "games.blink.releaseEarly": "Тым ерте босаттыңыз! Қайта бастаймыз.",
    "games.blink.hintRound1": "Экранды басып, қысу! 5 секундта 8 рет!",
    "games.blink.hintRound2": "Тышқан батырмасын басып ұста / түртіп, 3 секунд ұста!",
    "games.blink.hintRound3": "Шкала жасыл аймақта болғанда басыңыз!",
    "games.tracker.hintUpDown": "Допты жоғары-төмен қадағалаңыз 👆👇",
    "games.tracker.hintLeftRight": "Допты солға-оңға қадағалаңыз 👈👉",
    "games.tracker.hintClockwise": "Допты сағат тілі бойынша қадағалаңыз ⭕",
    "games.tracker.hintCounterClockwise": "Допты сағат тіліне қарсы қадағалаңыз 🔄",
    "games.tracker.getReady": "Дайындал...",
    "achievements.unlocked": "🏆 Жетістік ашылды!",
    "achievements.title": "Жетістіктер",
}

zh_translations = {
    # These are the 58 empty keys in zh.json - mainly long texts
    "about.p1": "在遥远的宇宙中，存在着一颗名为维迪亚尔的星球——一个每个居民都致力于保护地球儿童视力的世界。但有一天，大黑暗威胁要吞噬这颗星球……",
    "about.p2": "从一个古老的仪式中，出现了一个有着巨大蓝眼睛的女孩——超级眼睛。她穿着红色制服，披着白色斗篷，踏上旅程拯救维迪亚尔，并教会孩子们如何照顾自己的眼睛。",
    "about.p3": "与忠实的朋友——万尼亚、智慧水晶和顾问一起，她经历了令人兴奋的冒险、迷你游戏和眼部训练。每一帧都有配音，每一个选择都很重要！",
    "episodes.ep1.desc": "维迪亚尔星球处于危险之中。古老的仪式召唤了一位守护者——一个拥有视力超能力的女孩。",
    "episodes.ep2.desc": "超级眼睛了解了自己的使命。训练、初次试炼以及与黑暗的相遇。",
    "episodes.ep3.desc": "与大黑暗的最终对抗。维迪亚尔星球的整个未来掌握在你的手中！",
    "characters.superglazka.desc": "来自古老仪式的女孩，拥有视力超能力。穿着红色制服，披着白色斗篷，保护着孩子们。",
    "characters.vanya.desc": "地球上的男孩，第一个相信超级眼睛的人。帮助她完成拯救孩子们眼睛的任务。",
    "characters.wiseCrystal.desc": "维迪亚尔星球的英明统治者。进行了召唤仪式，并成为超级眼睛的导师。",
    "characters.lenivus.desc": "威胁吞噬维迪亚尔的大恶。它的弱点是活跃健康的眼睛！",
    "app.faqItems.howToPlay": "怎么玩？",
    "app.faqItems.saveProgress": "如何保存进度？",
    "app.faqItems.gamesHelp": "为什么需要迷你游戏？",
    "app.faqItems.eyeHealth": "这真的对眼睛有帮助吗？",
    "app.faqItems.forParents": "给家长",
    "app.faqItems.contacts": "联系方式",
    "app.gameTransition.title": "🎮 迷你游戏",
    "app.gameTransition.subtitle": "训练眼睛，帮助超级眼睛！",
    "app.gameTransition.start": "▶ 开始",
    # Additional JS keys
    "app.back": "◀ 返回",
    "app.audio": "🎵 音频",
    "app.narrator": "旁白",
    "app.bgMusic": "背景音乐",
    "app.subtitles": "💬 字幕",
    "app.accessibility": "♿ 无障碍",
    "app.interface": "🖥️ 界面",
    "app.highContrast": "高对比度",
    "app.reduceMotion": "减少动画",
    "app.textSize": "文字大小",
    "app.darkTheme": "深色主题",
    "games.blink.win": "眼睛状态良好！\n+100 🪙",
    "games.tracker.win": "眼睛休息好了！\n+100 🪙",
    "games.runner.level": "等级",
    "games.gym.title": "万尼亚对抗懒惰魔王！",
    "games.blink.name": "眨眼充电",
    "games.tracker.name": "追踪凝视",
    "characters.hrust": "智慧水晶",
    "characters.sovet": "顾问",
    "characters.dev": "女孩",
    "characters.tolpa": "人群",
    "characters.nar": "旁白",
    "player.defaultNickname": "玩家",
    "player.guestText": "你正以访客身份游戏。进度会保存，但金币暂时无法使用。",
    "player.createAccount": "🔐 创建完整账号",
    "player.login": "🔑 已有账号？登录",
    "player.enterLogin": "🔑 登录 / 注册",
    "player.logout": "🚪 退出",
    "games.blink.miss": "没击中！再试一次",
    "games.blink.timeUp": "时间到！再试一次。",
    "games.blink.releaseEarly": "放得太早了！重新开始。",
    "games.blink.hintRound1": "点击屏幕眨眼！5秒内8次！",
    "games.blink.hintRound2": "按住鼠标按钮 / 点击并保持3秒！",
    "games.blink.hintRound3": "当进度条在绿色区域时点击！",
    "games.tracker.hintUpDown": "跟随球上下移动 👆👇",
    "games.tracker.hintLeftRight": "跟随球左右移动 👈👉",
    "games.tracker.hintClockwise": "顺时针跟随球 ⭕",
    "games.tracker.hintCounterClockwise": "逆时针跟随球 🔄",
    "games.tracker.getReady": "准备...",
    "achievements.unlocked": "🏆 成就解锁！",
    "achievements.title": "成就",
}

# Process each locale
for lang, trans in [('en', en_translations), ('kz', kz_translations), ('zh', zh_translations)]:
    path = locales_dir / f"{lang}.json"
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    flat = flatten(data)
    
    # Remove junk keys
    for key in list(flat.keys()):
        if is_junk(key):
            del flat[key]
    
    # Fill empty keys with translations
    for key, value in trans.items():
        flat[key] = value
    
    # For any remaining empty keys, fallback to ru (but keep empty if ru also empty)
    for key in flat:
        if flat[key] == '' and key in ru_flat and ru_flat[key]:
            if lang == 'en':
                # For English, if no translation, use a rough transliteration or keep ru
                flat[key] = ru_flat[key]
            elif lang == 'kz':
                flat[key] = ru_flat[key]
            elif lang == 'zh':
                flat[key] = ru_flat[key]
    
    data = unflatten(flat)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Updated {path}")

# Also update ru.json to remove junk
with open(locales_dir / 'ru.json', 'r', encoding='utf-8') as f:
    ru_data = json.load(f)
ru_flat_clean = {k: v for k, v in flatten(ru_data).items() if not is_junk(k)}
with open(locales_dir / 'ru.json', 'w', encoding='utf-8') as f:
    json.dump(unflatten(ru_flat_clean), f, ensure_ascii=False, indent=2)
print("Updated ru.json (removed junk keys)")
