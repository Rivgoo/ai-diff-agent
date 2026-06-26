# Performance & React Best Practices

> **⚠️ CRITICAL SYSTEM RULE: REACT COMPILER IS ACTIVE**
> This project has the React Compiler enabled (`babel-plugin-react-compiler`). The compiler automatically optimizes component re-renders and memoizes JSX, functions, and arrays at build time.
> **DO NOT use manual memoization hooks (`useMemo`, `useCallback`, `React.memo()`) unless absolutely necessary for external library dependency compatibility.** Trust the compiler. Focus on structural, asynchronous, and architectural performance bottlenecks.

---

## 1. Eliminating Waterfalls (Async)

Асинхронні водоспади (Waterfalls) — головний вбивця продуктивності вебдодатків. Кожен послідовний виклик `await` додає повну затримку мережі (RFT). Наша мета — паралелізувати незалежні операції та раціонально використовувати ресурси.

### Check Cheap Conditions Before Async Flags
Коли розгалуження коду використовує `await` для отримання прапорця чи віддаленого значення, а також вимагає дешевої синхронної перевірки (пропси, локальний стан), завжди обчислюйте синхронну умову першою.

❌ Bad (непотрібний запуск асинхронної операції):
```typescript
const someFlag = await getFlagFromDatabase() // Завжди платимо за I/O або мережу

if (someFlag && localProps.isEnabled) {
  // ...
}
```

✅ Good (швидкий вихід без зайвих асинхронних викликів):
```typescript
if (localProps.isEnabled) {
  const someFlag = await getFlagFromDatabase() // Виклик робиться тільки при потребі
  if (someFlag) {
    // ...
  }
}
```

---

### Defer Await Until Needed
Переносьте операції `await` безпосередньо у ті гілки коду, де вони дійсно використовуються, щоб уникнути передчасного блокування виконання.

❌ Bad (блокує весь ланцюг, хоча дані потрібні не завжди):
```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId) // Чекаємо дані завжди
  
  if (skipProcessing) {
    return { skipped: true } // Повернули раніше, але час на fetchUserData вже витрачено
  }
  
  return processUserData(userData)
}
```

✅ Good (запит виконується тільки при потребі):
```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) {
    return { skipped: true } // Миттєве повернення без блокування
  }
  
  const userData = await fetchUserData(userId)
  return processUserData(userData)
}
```

---

### Promise.all() for Independent Operations
Коли асинхронні операції не мають взаємозалежностей, виконуйте їх паралельно за допомогою `Promise.all()`.

❌ Bad (послідовне очікування, 3 послідовні запити):
```typescript
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()
```

✅ Good (паралельне очікування, 1 загальний раунд-тріп):
```typescript
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

---

### Dependency-Based Parallelization
Для операцій з частковими залежностями створюйте проміси заздалегідь, а `Promise.all` викликайте наприкінці.

❌ Bad (профіль чекає конфіг, хоча залежить тільки від користувача):
```typescript
const [user, config] = await Promise.all([
  fetchUser(),
  fetchConfig()
])
const profile = await fetchProfile(user.id) // Почали вантажити тільки після завантаження config
```

✅ Good (config та profile вантажаться паралельно):
```typescript
const userPromise = fetchUser()
const configPromise = fetchConfig()

// Починаємо вантажити профіль відразу, як тільки вирішиться userPromise
const profilePromise = userPromise.then(user => fetchProfile(user.id))

const [user, config, profile] = await Promise.all([
  userPromise,
  configPromise,
  profilePromise
])
```

---

### Strategic Suspense Boundaries
Не блокуйте завантаження всієї сторінки очікуванням даних. Використовуйте межі `Suspense`, щоб показати інтерфейс оболонки (Shell) миттєво, доки дані завантажуються у фоні.

❌ Bad (весь лейаут чекає на повільний запит):
```tsx
async function Page() {
  const data = await fetchData() // Повністю блокує рендер сторінки
  
  return (
    <div className="layout">
      <Sidebar />
      <Header />
      <main>
        <DataDisplay data={data} />
      </main>
      <Footer />
    </div>
  )
}
```

✅ Good (оболонка рендериться миттєво, дані стрімляться):
```tsx
import { Suspense, use } from 'react'

function Page() {
  // Починаємо запит негайно, але НЕ чекаємо його тут
  const dataPromise = fetchData()

  return (
    <div className="layout">
      <Sidebar />
      <Header />
      <main>
        <Suspense fallback={<Skeleton />}>
          <DataDisplay dataPromise={dataPromise} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

function DataDisplay({ dataPromise }: { dataPromise: Promise<any> }) {
  const data = use(dataPromise) // Розпаковуємо проміс за допомогою React 19 use()
  return <div>{data.content}</div>
}
```

---

## 2. Bundle Size Optimization (Vite SPA)

Зменшення початкового розміру збірки напряму впливає на метрики Time to Interactive (TTI) та Largest Contentful Paint (LCP).

### Dynamic Imports for Heavy Components
Використовуйте комбінацію `React.lazy` та `Suspense` для динамічного завантаження важких модулів, які не потрібні під час першого відтворення сторінки.

❌ Bad (Важкий редактор Monaco вантажиться в основному бандлі):
```tsx
import { MonacoEditor } from './monaco-editor'

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />
}
```

✅ Good (Важкий редактор вантажиться ліниво у фоні):
```tsx
import { lazy, Suspense } from 'react'

// Лінивий імпорт компонента
const MonacoEditor = lazy(() => import('./monaco-editor').then(m => ({ default: m.MonacoEditor })))

function CodePanel({ code }: { code: string }) {
  return (
    <Suspense fallback={<div className="skeleton-loader">Loading editor...</div>}>
      <MonacoEditor value={code} />
    </Suspense>
  )
}
```

---

### Conditional Module Loading
Завантажуйте великі блоки даних або JS-модулі лише тоді, коли активована відповідна функція.

✅ Good (динамічний імпорт за умовою в useEffect):
```tsx
import React, { useState, useEffect } from 'react'

function AnimationPlayer({ enabled }) {
  const [frames, setFrames] = useState<any[] | null>(null)

  useEffect(() => {
    if (enabled && !frames) {
      // Модуль завантажується з сервера тільки при переході enabled в true
      import('./animation-frames.js').then(mod => setFrames(mod.frames))
    }
  }, [enabled, frames])

  if (!frames) return <div className="spinner">Buffering...</div>
  return <Canvas frames={frames} />
}
```

---

### Defer Non-Critical Third-Party Libraries
Сторонні аналітичні скрипти, логери помилок та пікселі соцмереж не повинні блокувати завантаження сторінки. Завантажуйте їх асинхронно після монтування додатку.

❌ Bad (блокує завантаження основного JS):
```html
<head>
  <script src="https://analytics.example.com/sdk.js"></script>
</head>
```

✅ Good (асинхронне ліниве монтування у useEffect):
```tsx
import { useEffect } from 'react'

function AnalyticsLoader() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://analytics.example.com/sdk.js'
    script.async = true
    script.defer = true
    document.body.appendChild(script)
    
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return null
}
```

---

### Preload Based on User Intent
Попередньо завантажуйте ліниві бандли при наведенні курсору миші (hover) або фокусі на кнопці.

✅ Good:
```tsx
import React, { lazy, Suspense, useState } from 'react'

const MonacoEditorImport = () => import('./monaco-editor')

function EditorButton() {
  const [show, setShow] = useState(false)

  // Починаємо завантажувати JS-файл при наведенні курсору, а не після кліку!
  const handlePreload = () => {
    MonacoEditorImport()
  }

  return (
    <>
      <button 
        onMouseEnter={handlePreload} 
        onFocus={handlePreload}
        onClick={() => setShow(true)}
      >
        Configure Code
      </button>
      
      {show && (
        <Suspense fallback={<div>Loading...</div>}>
          <LazyEditor />
        </Suspense>
      )}
    </>
  )
}

const LazyEditor = lazy(() => MonacoEditorImport().then(m => ({ default: m.MonacoEditor })))
```

---

## 3. Client-Side Optimization

### Deduplicate Global Event Listeners
Коли декілька компонентів реєструють глобальні слухачі подій (наприклад, натискання клавіш), використовуйте загальний модуль реєстрації (Map/Set), щоб уникнути створення N дублюючих слухачів на рівні `window`.

❌ Bad (N інстансів компонента = N слухачів подій):
```tsx
function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === key) callback()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, callback])
}
```

✅ Good (Всі компоненти ділять 1 глобальний слухач):
```tsx
const keyListeners = new Map<string, Set<() => void>>()

// Створюємо єдиний слухач один раз на рівні модуля
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    const callbacks = keyListeners.get(e.key)
    if (callbacks) {
      callbacks.forEach(cb => cb())
    }
  })
}

function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    if (!keyListeners.has(key)) {
      keyListeners.set(key, new Set())
    }
    keyListeners.get(key)!.add(callback)

    return () => {
      const callbacks = keyListeners.get(key)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) keyListeners.delete(key)
      }
    }
  }, [key, callback])
}
```

---

## 4. Re-render Optimization (Structural)

Ці правила не може автоматично виправити компілятор React, оскільки вони стосуються структури та архітектури ваших компонентів.

### Defer State Reads to Usage Point
Не підписуйтеся на динамічні дані (пошукові параметри, стейт-менеджери, localStorage) на рівні всього компонента, якщо ви читаєте ці дані виключно всередині колбеків натискання.

❌ Bad (компонент рендериться при будь-якій зміні URL-параметрів, хоча дані потрібні тільки при кліку):
```tsx
import { useSearchParams } from 'react-router-dom'

function ShareButton({ chatId }) {
  const [searchParams] = useSearchParams() // Викликає ререндер компонента при кожній зміні URL

  const handleShare = () => {
    const ref = searchParams.get('ref')
    shareChat(chatId, { ref })
  }

  return <button onClick={handleShare}>Share Chat</button>
}
```

✅ Good (зчитування даних за запитом у момент кліку, немає підписки на рендеринг):
```tsx
function ShareButton({ chatId }) {
  const handleShare = () => {
    // Читаємо нативно з об'єкта window безпосередньо при натисканні
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    shareChat(chatId, { ref })
  }

  return <button onClick={handleShare}>Share Chat</button>
}
```

---

### useDeferredValue for Expensive Derived Renders
Використовуйте `useDeferredValue`, щоб важкі обчислення або рендеринг великих списків не блокували введення символів у текстове поле (Input).

❌ Bad (введення тексту лагає, бо фільтрація списку блокує головний потік):
```tsx
function Search({ items }) {
  const [query, setQuery] = useState('')
  const filtered = items.filter(item => fuzzyMatch(item, query)) // Важка операція при кожному натисканні клавіші

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ResultsList results={filtered} />
    </div>
  )
}
```

✅ Good (введення миттєве, список оновлюється з невеликою затримкою при простої процесора):
```tsx
import { useState, useDeferredValue } from 'react'

function Search({ items }) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query) // Отримує низький пріоритет оновлення
  
  // Компілятор автоматично оптимізує фільтрацію, оскільки вона залежить від deferredQuery
  const filtered = items.filter(item => fuzzyMatch(item, deferredQuery))
  const isStale = query !== deferredQuery

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        <ResultsList results={filtered} />
      </div>
    </div>
  )
}
```

---

## 5. Rendering Performance

### Animate SVG Wrapper Instead of SVG Element
Браузери погано анімують трансформації безпосередньо на тегах `<svg>` або `<path>`, оскільки вони не завжди створюють окремий шар композиції на GPU. Завжди анімуйте обгортку `<div>`.

❌ Bad (анімація на пряму на SVG навантажує процесор):
```tsx
function LoadingSpinner() {
  return (
    <svg className="animate-spin-rotation" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  )
}
```

✅ Good (анімація на обгортці використовує апаратне прискорення відеокарти):
```tsx
function LoadingSpinner() {
  return (
    <div className="animate-spin-rotation" style={{ display: 'inline-block', width: 24, height: 24 }}>
      <svg width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    </div>
  )
}
```

---

### CSS content-visibility for Long Lists
Для довгих статичних сторінок або списків використовуйте CSS властивість `content-visibility: auto`, яка дозволяє браузеру повністю пропустити етапи розрахунку макету (layout) та малювання (paint) для елементів, які знаходяться поза екраном.

✅ Good (масштабована продуктивність рендерингу тисяч елементів):
```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px; /* Вказуємо очікуваний розмір елемента для уникнення стрибків скролбару */
}
```

---

### SVG Precision Reduction (Оптимізація точності координат)
Надлишкова точність у десяткових значеннях координат шляхів (`d`) в SVG безглуздо роздуває розмір коду та ускладнює розрахунки рендерингу для браузера. Округлюйте значення до 1 знака після коми.

❌ Bad: `<path d="M 10.293847 20.847362 L 30.938472 40.192837" />`
✅ Good: `<path d="M 10.3 20.8 L 30.9 40.2" />`

---

## 6. JavaScript Performance (Мікро-оптимізації для гарячих шляхів)

### Avoid Layout Thrashing (Уникнення збурення макету)
Ніколи не чергуйте читання геометричних властивостей DOM із записом стилів. Читання змушує браузер зупинити виконання JS і виконати синхронний перерахунок макету (reflow).

❌ Bad (читання offsetHeight чергується із записом style.height, викликаючи безліч reflow):
```typescript
function resizeElements(elements: HTMLElement[]) {
  for (const el of elements) {
    const height = el.offsetHeight // Читання геометричного параметра (1 reflow)
    el.style.width = `${height * 2}px` // Запис стилю (Invalidates layout)
  }
}
```

✅ Good (спочатку зчитуємо всі дані, потім пакетом записуємо):
```typescript
function resizeElements(elements: HTMLElement[]) {
  // Крок 1: Тільки читання (Браузер робить лише 1 reflow для всієї пачки)
  const heights = elements.map(el => el.offsetHeight)
  
  // Крок 2: Тільки запис
  elements.forEach((el, index) => {
    el.style.width = `${heights[index] * 2}px`
  })
}
```

---

### Build Index Maps for Repeated Lookups
Коли ви шукаєте елементи в масиві B для кожного елемента з масиву A (вкладений пошук O(N*M)), завжди трансформуйте масив пошуку в `Map` для миттєвого пошуку O(1).

❌ Bad (O(N*M) складність, пошук запускає повний прохід по масиву users для кожного замовлення):
```typescript
function processOrders(orders: Order[], users: User[]) {
  return orders.map(order => ({
    ...order,
    user: users.find(u => u.id === order.userId) // Лінійний пошук на кожній ітерації
  }))
}
```

✅ Good (O(N + M) складність, будуємо індекс карту):
```typescript
function processOrders(orders: Order[], users: User[]) {
  // Побудова карти за лінійний час O(M)
  const userById = new Map<string, User>(users.map(u => [u.id, u]))

  // Пошук за O(1) на кожній ітерації
  return orders.map(order => ({
    ...order,
    user: userById.get(order.userId)
  }))
}
```

---

### Cache Storage API Calls (Кешування localStorage)
Звернення до `localStorage` та `document.cookie` є синхронними, блокуючими та дуже повільними I/O операціями. Завжди створюйте memory-cache для цих значень.

❌ Bad (читає localStorage при кожному зверненні):
```typescript
function getTheme() {
  return localStorage.getItem('theme') ?? 'light'
}
```

✅ Good (читає з диска лише 1 раз, далі віддає з пам'яті):
```typescript
const storageCache = new Map<string, string | null>()

function getCachedStorage(key: string): string | null {
  if (!storageCache.has(key)) {
    storageCache.set(key, localStorage.getItem(key))
  }
  return storageCache.get(key) ?? null
}

function setCachedStorage(key: string, value: string): void {
  localStorage.setItem(key, value)
  storageCache.set(key, value) // Оновлюємо кеш
}
```

---

### Use flatMap to Map and Filter in One Pass
Замість ланцюжка `.map().filter(Boolean)`, який двічі ітерує масив і створює проміжний об'єкт у пам'яті, використовуйте нативний метод `.flatMap()`.

❌ Bad (2 ітерації, 2 масиви в пам'яті):
```typescript
const activeUserNames = users
  .map(u => u.isActive ? u.name : null)
  .filter(Boolean)
```

✅ Good (1 ітерація, 1 масив в пам'яті):
```typescript
const activeUserNames = users.flatMap(u => 
  u.isActive ? [u.name] : []
)
```

---

### Use requestIdleCallback for Non-Critical Work
Використовуйте `requestIdleCallback` для планування некритичних фонових завдань (наприклад, надсилання телеметрії або синхронізація локальної бази даних), щоб вони не заважали плавній роботі інтерфейсу.

✅ Good:
```typescript
function logTelemetry(data: TelemetryData) {
  const scheduleWork = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1))
  
  scheduleWork(() => {
    fetch('/api/telemetry', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  })
}
```

---

## 7. Advanced Hooks Patterns

### Do Not Put Effect Events in Dependency Arrays
Функції, створені за допомогою `useEffectEvent` (експериментальний API React, стабільний у Compiler-середовищі), є нереактивними за своєю природою. Їхня ідентичність змінюється при кожному рендерингу. **Ніколи не додавайте результати `useEffectEvent` у масив залежностей `useEffect`.**

❌ Bad (ефект буде перезапускатися при кожній зміні контексту колбеку):
```tsx
import { useEffect, useEffectEvent } from 'react'

function ChatRoom({ roomId, onConnected }) {
  const handleConnected = useEffectEvent(onConnected)

  useEffect(() => {
    const conn = createConnection(roomId)
    conn.on('connect', handleConnected)
    conn.connect()
    return () => conn.disconnect()
  }, [roomId, handleConnected]) // Помилка! handleConnected не повинен бути тут
}
```

✅ Good (ефект залежить тільки від реактивного roomId):
```tsx
import { useEffect, useEffectEvent } from 'react'

function ChatRoom({ roomId, onConnected }) {
  const handleConnected = useEffectEvent(onConnected)

  useEffect(() => {
    const conn = createConnection(roomId)
    conn.on('connect', handleConnected)
    conn.connect()
    return () => conn.disconnect()
  }, [roomId]) // Правильно: перезапускається тільки при зміні кімнати
}
```
