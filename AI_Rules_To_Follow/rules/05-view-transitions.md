# ==============================================================================
# AI File Generation & Management Script - 05-VIEW-TRANSITIONS FULL INTEGRATION
# Instruction: Run this script from the ROOT of the project.
# ==============================================================================

# Ensures the script throws exceptions rather than continuing silently
$ErrorActionPreference = "Stop" 

# Helper function for execution logging
function Write-Log {
    param([string]$Message, [string]$Type = "Info")
    $color = switch ($Type) {
        "Success" { "Green" }
        "Error"   { "Red" }
        "Warning" { "Yellow" }
        Default   { "Cyan" }
    }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [$Type] $Message" -ForegroundColor $color
}

# File Creation Wrapper
function Write-CodeFile {
    param(
        [Parameter(Mandatory=$true)][string]$RelativePath, 
        [Parameter(Mandatory=$true)][string]$Content
    )
    try {
        $fullPath = Join-Path $PWD $RelativePath
        $dir = Split-Path $fullPath
        
        # Auto-create missing directories
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
            Write-Log "Created directory: $dir" "Info"
        }
        
        # Write content safely
        Set-Content -Path $fullPath -Value $Content -Encoding UTF8 -Force
        Write-Log "Created/Updated file: $RelativePath" "Success"
    } catch {
        Write-Log "Failed to write file $RelativePath. Error: $_" "Error"
    }
}

# ==============================================================================
# Execution
# ==============================================================================

Write-Log "Starting deep integration for 05-view-transitions.md..." "Info"

Write-CodeFile -RelativePath "AI_Rules_To_Follow/rules/05-view-transitions.md" -Content @'
# React View Transitions

Цей документ містить повне керівництво з реалізації плавних, апаратно-прискорених анімацій та переходів між сторінками за допомогою нативного браузерного View Transition API в React.

---

## 1. Коли анімувати (Правила просторового зв'язку)

Кожна анімація `<ViewTransition>` повинна допомагати користувачу зрозуміти просторовий зв'язок або спадкоємність елементів при зміні інтерфейсу. Якщо ви не можете пояснити, що саме полегшує анімація — не додавайте її.

Завжди впроваджуйте патерни анімації в такому порядку пріоритетності:

| Пріоритет | Патерн | Що він повідомляє користувачу |
| :--- | :--- | :--- |
| 1 | **Спільний елемент** (`name`) | "Це один і той самий об'єкт, ви переходите глибше в деталі" |
| 2 | **Поява з Suspense** | "Дані успішно завантажилися, ось контент" |
| 3 | **Ідентичність списку** (per-item `key`) | "Елементи ті самі, але вони перегрупувалися/відсортувалися" |
| 4 | **Зміна стану** (`enter`/`exit`) | "Цей блок з'явився або зник з екрана" |
| 5 | **Зміна маршруту** (Page-level) | "Ви перейшли у зовсім нове місце додатка" |

### Правила вибору стилю анімацій:
*   **Ієрархічна навігація (list → detail):** Використовуйте горизонтальні слайди `nav-forward` (поява справа) та `nav-back` (поява зліва). Це візуально симулює перехід у глибину.
*   **Латеральна навігація (tab-to-tab або карусель):** Використовуйте просте перехресне згасання (fade) або взагалі вимикайте анімацію слайду (`default="none"`), оскільки тут немає глибини.
*   **Поява контенту (Suspense):** Використовуйте плавне вертикальне підняття з прозорістю (`slide-up`).

---

## 2. Core Concepts (Базові концепції)

### Компонент `<ViewTransition>`
Компонент `<ViewTransition>` автоматично генерує унікальне ім'я `view-transition-name` для DOM-вузла, захоплює скріншот стану до і після оновлення та викликає нативний браузерний метод `document.startViewTransition`.

```jsx
import { ViewTransition } from 'react'

<ViewTransition>
  <MyComponent />
</ViewTransition>
```

### Анімаційні тригери (Triggers)
Анімації запускаються тільки тоді, коли мутація стану відбувається всередині переходів React: `startTransition`, `useDeferredValue` або під час вирішення промісів у `Suspense`. Звичайний `setState` не активує анімації.

*   **`enter`** — Спрацьовує, коли `<ViewTransition>` вперше монтується в DOM-дерево під час переходу.
*   **`exit`** — Спрацьовує, коли `<ViewTransition>` демонтується з DOM під час переходу.
*   **`update`** — Спрацьовує при зміні DOM-структури всередині вже змонтованого компонента `<ViewTransition>`.
*   **`share`** — Найбільш пріоритетний тригер. Спрацьовує, коли один іменований VT зникає, а інший з таким самим `name` з'являється в іншому місці дерева під час одного й того самого переходу.

### ⚠️ Критичне правило розташування у дереві DOM
Компонент `<ViewTransition>` активує тригери `enter` та `exit` **тільки якщо він знаходиться безпосередньо перед першим DOM-вузлом** у JSX. Якщо між ними є проміжний тег (наприклад, `div` обгортка), анімація монтування/демонтування не відбудеться.

❌ Broken (DOM-вузол огортає VT — анімація зламана):
```jsx
<div className="wrapper">
  <ViewTransition enter="fade-in" exit="fade-out">
    <div className="content">Hello</div>
  </ViewTransition>
</div>
```

✅ Correct (VT безпосередньо контролює перший DOM-вузол):
```jsx
<div className="wrapper">
  <ViewTransition enter="fade-in" exit="fade-out">
    <div className="content">Hello</div>
  </ViewTransition>
</div>
```

---

## 3. Transition Types (Типи переходів)

Ви можете тегувати (маркувати) асинхронні переходи за допомогою методу `addTransitionType`, щоб компоненти `<ViewTransition>` могли обирати різні CSS класи анімації залежно від напрямку навігації.

```tsx
import { startTransition, addTransitionType } from 'react'

function handleForwardNavigation(path: string) {
  startTransition(() => {
    addTransitionType('nav-forward') // Тегуємо перехід як рух вперед
    router.push(path) // Ваш SPA роутер
  })
}

function handleBackNavigation(path: string) {
  startTransition(() => {
    addTransitionType('nav-back') // Тегуємо перехід як рух назад
    router.push(path)
  })
}
```

Використовуйте об'єктне відображення типів на класи у пропсах `enter` та `exit`:

```tsx
<ViewTransition
  enter={{ 'nav-forward': 'slide-from-right', 'nav-back': 'slide-from-left', default: 'none' }}
  exit={{ 'nav-forward': 'slide-to-left', 'nav-back': 'slide-to-right', default: 'none' }}
  default="none"
>
  <main>{children}</main>
</ViewTransition>
```

> **Важливо для TypeScript:** Словники типів зобов'язані містити поле `default`, інакше TypeScript видасть помилку типу `ViewTransitionClassPerType`.

---

## 4. Shared Element Transitions (Спільні елементи)

Передаючи однакове ім'я в пропс `name` двох різних компонентів `<ViewTransition>` (один демонтується, інший монтується), ви створюєте безшовну анімацію трансформації (morphing).

```tsx
// На сторінці списку:
<ViewTransition name={`avatar-${user.id}`} share="morph" default="none">
  <img src={user.avatarUrl} className="w-10 h-10 rounded-full" />
</ViewTransition>

// На сторінці детального профілю:
<ViewTransition name={`avatar-${user.id}`} share="morph">
  <img src={user.avatarUrl} className="w-32 h-32 rounded-full" />
</ViewTransition>
```

### Правила роботи зі спільними елементами:
1.  **Унікальність імен:** Імена `name` мають бути глобально унікальними на екрані. Завжди додавайте унікальні ID до рядків: `photo-${id}`.
2.  **Заборона дублікатів:** Не можна одночасно монтувати два активні компоненти з однаковим `name`. Це призведе до помилки браузера та скасування анімації.
3.  **Композиція з ідентичністю списку:** Коли ви анімуєте елемент у списку, який одночасно може перевпорядковуватись і переходити в детальну сторінку, завжди розділяйте ці зони відповідальності на два вкладені рівні `<ViewTransition>`:

```tsx
// Двошарова архітектура списку
{items.map(item => (
  <ViewTransition key={item.id}>                                        {/* Шаг 1: Контролює реордер самого списку */}
    <div className="card">
      <Link to={`/detail/${item.id}`}>
        <ViewTransition name={`item-img-${item.id}`} share="morph" default="none"> {/* Шаг 2: Контролює морфінг картинки */}
          <img src={item.image} />
        </ViewTransition>
      </Link>
    </div>
  </ViewTransition>
))}
```

---

## 5. Покроковий процес впровадження (Implementation Workflow)

Дотримуйтесь цих кроків суворо по черзі під час додавання переходів у проєкт.

### Крок 1: Аудит інтерфейсу додатка
Перед написанням коду знайдіть у вашому проєкті:
*   Усі виклики переходів роутера (`router.push`) — це точки запуску анімації.
*   Усі межі `<Suspense>` — це кандидати на вертикальну появу контенту (`slide-up`).
*   Усі персистентні елементи (хедери, бокові меню), які повинні залишатися нерухомими під час руху сторінок.

### Крок 2: Додавання базових CSS рецептів
Скопіюйте повний набір CSS рецептів (див. Розділ 7) у ваш глобальний файл стилів (`index.css` або `App.css`).

### Крок 3: Ізоляція персистентних елементів сторінки
Задайте унікальне ім'я `viewTransitionName` у стилях для шапки сайту або бокового меню, щоб браузер не намагався сфотографувати їх разом із контентом сторінки:

```tsx
<header style={{ viewTransitionName: 'site-header' }}>
  <Logo />
</header>
```

Додайте правило ігнорування анімації для цієї групи у CSS:
```css
::view-transition-group(site-header) {
  animation: none;
  z-index: 100;
}
```

### Крок 4: Створення обгортки сторінок
Створіть спільний компонент-обгортку `DirectionalTransition` для сторінок вашого додатка:

```tsx
export function DirectionalTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ 'nav-forward': 'slide-from-right', 'nav-back': 'slide-from-left', default: 'none' }}
      exit={{ 'nav-forward': 'slide-to-left', 'nav-back': 'slide-to-right', default: 'none' }}
      default="none"
    >
      {children}
    </ViewTransition>
  )
}
```

Обгорніть контент кожної сторінки цим компонентом.

### Крок 5: Налаштування появи Suspense
Обгорніть фолбек вашого Suspense та сам асинхронний контент окремими VT, щоб вони плавно змінювали один одного:

```tsx
<Suspense 
  fallback={
    <ViewTransition exit="slide-down">
      <Skeleton />
    </ViewTransition>
  }
>
  <ViewTransition enter="slide-up" default="none">
    <MyAsyncContent />
  </ViewTransition>
</Suspense>
```

---

## 6. Advanced Patterns & APIs (Складні інтерактивні сценарії)

### Фільтрація сітки за допомогою `useDeferredValue`
Завдяки `useDeferredValue` оновлення списку стає переходом (Transition), що дозволяє анімувати картки при фільтрації чи пошуку.

```tsx
import { useState, useDeferredValue, ViewTransition, Suspense } from 'react'

export default function SearchableGrid({ items }) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search) // Створює перехід при зміні тексту
  
  const filtered = items.filter(item => item.name.includes(deferredSearch))

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      
      <div className="grid">
        {filtered.map(item => (
          <ViewTransition key={item.id} default="none">
            <ItemCard name={item.name} />
          </ViewTransition>
        ))}
      </div>
    </div>
  )
}
```

---

### Імплементація подій анімації (View Transition Events API)
Ви можете гнучко керувати анімаціями через JavaScript за допомогою подій `onEnter`, `onExit` та `onShare`. Вони приймають об'єкт `instance` типу `ViewTransitionDOMInstance` та масив активних типів переходу.

```tsx
<ViewTransition
  onEnter={(instance, types) => {
    // Використовуємо Web Animations API для кастомного розширення анімації
    const animation = instance.new.animate(
      [
        { transform: 'scale(0.8) translateY(20px)', opacity: 0 },
        { transform: 'scale(1) translateY(0px)', opacity: 1 }
      ],
      {
        duration: 350,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }
    )

    // Обов'язково повертайте функцію очищення
    return () => animation.cancel()
  }}
>
  <div className="box">Animated Box</div>
</ViewTransition>
```

---

### Виключення елементів через `useOptimistic`
Оскільки оптимістичний стан в React оновлюється до моменту створення моментального знімка (snapshot) екрана, використовуйте `useOptimistic` для елементів інтерфейсу, які повинні змінитися миттєво без анімації (наприклад, текстові мітки перемикання сортування), доки сам контент анімується плавно.

---

## 7. CSS Animation Recipes (Готові анімаційні рецепти)

Скопіюйте ці стилі у ваш глобальний файл CSS. Вони забезпечують ідеальну плавність, кінематографічний ефект розмиття при русі (motion blur) та поважають системні налаштування доступності.

```css
:root {
  --duration-exit: 150ms;
  --duration-enter: 210ms;
  --duration-move: 400ms;
}

/* Спільні ключові кадри */
@keyframes fade {
  from { filter: blur(3px); opacity: 0; }
  to { filter: blur(0); opacity: 1; }
}

@keyframes slide {
  from { translate: var(--slide-offset); }
  to { translate: 0; }
}

@keyframes slide-y {
  from { transform: translateY(var(--slide-y-offset, 10px)); }
  to { transform: translateY(0); }
}

/* 1. Патерн: Просте згасання (Fade) */
::view-transition-old(.fade-out) {
  animation: var(--duration-exit) ease-in fade reverse;
}
::view-transition-new(.fade-in) {
  animation: var(--duration-enter) ease-out var(--duration-exit) both fade;
}

/* 2. Патерн: Вертикальне підняття (Slide Vertical) */
::view-transition-old(.slide-down) {
  animation:
    var(--duration-exit) ease-out both fade reverse,
    var(--duration-exit) ease-out both slide-y reverse;
}
::view-transition-new(.slide-up) {
  animation:
    var(--duration-enter) ease-in var(--duration-exit) both fade,
    var(--duration-move) ease-in both slide-y;
}

/* 3. Патерн: Навігаційні слайди вперед/назад */
::view-transition-old(.nav-forward) {
  --slide-offset: -60px;
  animation:
    var(--duration-exit) ease-in both fade reverse,
    var(--duration-move) ease-in-out both slide reverse;
}
::view-transition-new(.nav-forward) {
  --slide-offset: 60px;
  animation:
    var(--duration-enter) ease-out var(--duration-exit) both fade,
    var(--duration-move) ease-in-out both slide;
}

::view-transition-old(.nav-back) {
  --slide-offset: 60px;
  animation:
    var(--duration-exit) ease-in both fade reverse,
    var(--duration-move) ease-in-out both slide reverse;
}
::view-transition-new(.nav-back) {
  --slide-offset: -60px;
  animation:
    var(--duration-enter) ease-out var(--duration-exit) both fade,
    var(--duration-move) ease-in-out both slide;
}

/* 4. Патерн: Спільний морфінг елементів з розмиттям */
::view-transition-group(.morph) {
  animation-duration: var(--duration-move);
}
::view-transition-image-pair(.morph) {
  animation-name: via-blur;
}
@keyframes via-blur {
  30% { filter: blur(3px); }
}

/* 5. Патерн: Морфінг текстових блоків (запобігає розмиттю тексту при збільшенні) */
::view-transition-group(.text-morph) {
  animation-duration: var(--duration-move);
}
::view-transition-old(.text-morph) {
  display: none;
}
::view-transition-new(.text-morph) {
  animation: none;
  object-fit: none;
  object-position: left top;
}

/* 6. Патерн: Масштабування (Scale) */
::view-transition-old(.scale-out) {
  animation: var(--duration-exit) ease-in scale-down;
}
::view-transition-new(.scale-in) {
  animation: var(--duration-enter) ease-out var(--duration-exit) both scale-up;
}
@keyframes scale-down {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.85); opacity: 0; }
}
@keyframes scale-up {
  from { transform: scale(0.85); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 7. Обхід проблеми з Backdrop-Filter (flicker fix) */
::view-transition-old(site-header) {
  display: none;
}
::view-transition-new(site-header) {
  animation: none;
}

/* 8. Системне вимкнення руху для підвищеної чутливості */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*),
  ::view-transition-group(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}
```
'@

Write-Log "05-view-transitions.md successfully generated with complete native web patterns!" "Success"
Write-Log "Script execution finished." "Info"
# Mandatory Pause Block
Write-Host "`nPress Enter to exit..." -ForegroundColor Yellow
[void]$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")