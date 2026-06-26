# State Management

Цей документ описує стандарти керування станом додатку, архітектуру контекстів для впровадження залежностей (Dependency Injection), правила декуплінгу UI від бізнес-логіки, а також сучасні API React 19 для роботи з контекстом та посиланнями (refs).

---

## 1. React 19 APIs: Context and Refs (Контексти та рефи в React 19)

В React 19 кардинально спрощено роботу з рефами та контекстом:
1. **`ref` більше не потребує обгортки `forwardRef`**. Тепер `ref` є звичайним пропсом компонента.
2. **`use()` замінює `useContext()`**. На відміну від `useContext()`, новий хук `use()` можна викликати умовного всередині блоків `if` та циклів `for`.

### ❌ Incorrect (застарілий React 18 підхід із forwardRef та useContext):
```tsx
import React, { createContext, useContext, forwardRef } from 'react'

const ThemeContext = createContext<string | null>(null)

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

// Потребує складного форвардингу типів та обгортки
const CustomInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const theme = useContext(ThemeContext)
  return <input ref={ref} className={`input-${theme}`} {...props} />
})
```

### ✅ Correct (сучасний декларативний підхід React 19):
```tsx
import React, { createContext, use } from 'react'

const ThemeContext = createContext<string | null>(null)

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement | null> // ref передається як стандартний пропс
}

function CustomInput({ ref, ...props }: InputProps) {
  //use() працює так само як useContext, але підтримує умовні виклики
  const theme = use(ThemeContext) 
  
  return <input ref={ref} className={`input-${theme}`} {...props} />
}
```

---

## 2. Generic Context Interfaces for Dependency Injection (Універсальні інтерфейси контекстів)

Для забезпечення повторного використання UI-компонентів, завжди описуйте інтерфейс контексту у вигляді трикомпонентної структури: `state` (дані), `actions` (методи мутації) та `meta` (нереактивні дані, наприклад, рефи). 

Ця абстракція працює як архітектурний контракт. Компоненти UI споживають цей інтерфейс, не знаючи, як саме реалізований стан під капотом. Це дозволяє використовувати однакові UI-компоненти з абсолютно різними провайдерами стану.

### ❌ Incorrect (компонент UI жорстко зв'язаний із конкретною реалізацією стану):
```tsx
import React from 'react'
import { useChannelComposerState } from '@/store/useChannelComposerState'

function ComposerInput() {
  // Компонент прив'язаний до специфічного глобального стору каналу.
  // Його неможливо перевикористати для редагування повідомлень або у спливаючих вікнах.
  const { input, setInput } = useChannelComposerState()
  return <input value={input} onChange={(e) => setInput(e.target.value)} />
}
```

### ✅ Correct (компонент залежить від абстрактного контракту):
```tsx
import React, { createContext, use, useState, useRef } from 'react'

interface Attachment {
  id: string
  url: string
}

// 1. Створюємо строго типізований інтерфейс-контракт контексту
export interface ComposerState {
  input: string
  attachments: Attachment[]
  isSubmitting: boolean
}

export interface ComposerActions {
  update: (updater: (state: ComposerState) => ComposerState) => void
  submit: () => void
}

export interface ComposerMeta {
  inputRef: React.RefObject<HTMLInputElement | null>
}

export interface ComposerContextValue {
  state: ComposerState
  actions: ComposerActions
  meta: ComposerMeta
}

export const ComposerContext = createContext<ComposerContextValue | null>(null)

// 2. UI-компонент залежить тільки від інтерфейсу контексту через React 19 use()
export function ComposerInput() {
  const context = use(ComposerContext)
  if (!context) {
    throw new Error('ComposerInput must be used within a ComposerContext Provider')
  }

  const { state, actions, meta } = context

  return (
    <input
      ref={meta.inputRef}
      value={state.input}
      onChange={(e) => actions.update((s) => ({ ...s, input: e.target.value }))}
      className="composer-input-field"
      placeholder="Write a message..."
    />
  )
}
```

---

## 3. Decouple State Management from UI (Декуплінг логіки стану та UI)

Провайдер компонента — це єдине місце, яке знає деталі реалізації стану додатку. Самі UI-компоненти не мають знати, звідки походять дані: з локального `useState`, глобального Zustand-стору, чи синхронізуються в реальному часі через WebSocket.

### Приклад: Два абсолютно різні провайдери імплементують спільний `ComposerContext`

Це дозволяє нам міняти бізнес-логіку та джерела даних, не змінюючи жодного рядка коду в UI-компонентах.

```tsx
// Спільна заглушка для початкового стану
const initialState: ComposerState = {
  input: '',
  attachments: [],
  isSubmitting: false
}

// ПРОВАЙДЕР А: Реалізація через ЛОКАЛЬНИЙ стан (для одноразових форм, наприклад, пересилання повідомлення)
export function ForwardMessageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ComposerState>(initialState)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const submit = async () => {
    setState(s => ({ ...s, isSubmitting: true }))
    try {
      await fetch('/api/messages/forward', {
        method: 'POST',
        body: JSON.stringify({ text: state.input })
      })
      setState(initialState)
    } catch (e) {
      console.error(e)
    } finally {
      setState(s => ({ ...s, isSubmitting: false }))
    }
  }

  return (
    <ComposerContext
      value={{
        state,
        actions: { update: setState, submit },
        meta: { inputRef }
      }}
    >
      {children}
    </ComposerContext>
  )
}

// ПРОВАЙДЕР Б: Реалізація через ГЛОБАЛЬНИЙ синхронізований стор (наприклад, Zustand + WebSocket-синхронізація)
import { useGlobalChannelSync } from '@/hooks/useGlobalChannelSync'

export function ChannelProvider({ channelId, children }: { channelId: string; children: React.ReactNode }) {
  // useGlobalChannelSync повертає реактивний стан та методи, які повністю відповідають нашому контракту
  const { state, update, submit } = useGlobalChannelSync(channelId)
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <ComposerContext
      value={{
        state,
        actions: { update, submit },
        meta: { inputRef }
      }}
    >
      {children}
    </ComposerContext>
  )
}
```

Тепер одна й та сама збірка UI працює в обох випадках:

```tsx
// Сценарій 1: Використання з локальним станом пересилання
<ForwardMessageProvider>
  <ComposerFrame>
    <ComposerInput />
    <ComposerSubmit />
  </ComposerFrame>
</ForwardMessageProvider>

// Сценарій 2: Використання з глобальним синхронізованим станом каналу
<ChannelProvider channelId="general">
  <ComposerFrame>
    <ComposerInput />
    <ComposerSubmit />
  </ComposerFrame>
</ChannelProvider>
```

---

## 4. Lift State to Leverage the "Provider Boundary" (Підняття стану та використання меж провайдера)

Провайдер створює логічну межу стану, яка не залежить від візуальної вкладеності DOM-дерева. Компоненти, яким потрібен спільний стан, не обов'язково мають бути візуально вкладені один в одного або в головний фрейм. Вони просто повинні знаходитись під парасолькою Провайдера.

Це повністю усуває антипатерни синхронізації через `useEffect` або прокидання колбеків нагору.

### ❌ Incorrect (стан заблоковано всередині візуального лейауту компоновщика):
Кнопка відправки та прев'ю повідомлення знаходяться в діалозі ззовні макета компоновщика, тому вони не мають доступу до його внутрішнього стану.

```tsx
import React, { useState } from 'react'

function ForwardMessageComposer() {
  const [input, setInput] = useState('') // Стан заблокований тут!
  return (
    <div className="composer-visual-box">
      <input value={input} onChange={e => setInput(e.target.value)} />
    </div>
  )
}

function ForwardMessageDialog() {
  return (
    <div className="dialog-window">
      <ForwardMessageComposer />
      
      {/* ПРЕДСТАВЛЕННЯ: Як воно отримає текст із ForwardMessageComposer? */}
      <div className="message-preview">Preview: ???</div>
      
      <div className="dialog-actions">
        <button type="button">Cancel</button>
        {/* КНОПКА: Як вона викличе submit із внутрішніми даними форми? */}
        <button type="button">Forward Now</button>
      </div>
    </div>
  )
}
```

### ✅ Correct (стан піднято в Провайдер, компоненти розташовані вільно):
Провайдер `ForwardMessageProvider` обгортає все діалогове вікно. Компоненти `ForwardButton` та `MessagePreview` візуально розташовані поза блоком вводу, але мають прямий і швидкий доступ до стану через контекст.

```tsx
import React, { use } from 'react'
import { ComposerContext, ForwardMessageProvider, ComposerInput } from './Composer'

function ForwardMessageDialog() {
  return (
    <ForwardMessageProvider>
      <div className="dialog-window">
        
        {/* Візуальний бокс вводу тексту */}
        <div className="composer-visual-box">
          <ComposerInput />
        </div>

        {/* Прев'ю знаходиться ЗОВНІ візуального боксу вводу, але ВСЕРЕДИНІ провайдера */}
        <MessagePreview />

        {/* Панель дій діалогу */}
        <div className="dialog-actions">
          <button type="button">Cancel</button>
          <ForwardButton />
        </div>
        
      </div>
    </ForwardMessageProvider>
  )
}

// Кнопка відправки діалогу бере екшн безпосередньо з контексту
function ForwardButton() {
  const { actions, state } = use(ComposerContext)
  return (
    <button 
      type="button" 
      onClick={actions.submit} 
      disabled={state.isSubmitting}
    >
      {state.isSubmitting ? 'Sending...' : 'Forward Now'}
    </button>
  )
}

// Прев'ю реактивно відображає введені дані
function MessagePreview() {
  const { state } = use(ComposerContext)
  return (
    <div className="message-preview">
      <strong>Preview:</strong> {state.input || 'No content yet...'}
    </div>
  )
}
```

---

## 5. Calculate Derived State During Rendering (Обчислення похідного стану під час рендерингу)

Ніколи не створюйте додатковий стан (`useState`) і не синхронізуйте його через ефекти (`useEffect`) для значень, які можна вирахувати з поточних пропсів або вже існуючого стану. Обчислюйте похідні значення прямо в процесі рендерингу. Це економить цикли рендерингу додатку та запобігає розсинхронізації даних (state drift).

### ❌ Incorrect (дублювання стану та зайві рендери через ефект):
При зміні імені або прізвища відбувається перший рендер з оновленими базовими даними, після чого запускається ефект, який викликає `setFullName`, що провокує **другий, повністю дублюючий цикл рендерингу** всього дерева.

```tsx
import React, { useState, useEffect } from 'react'

function UserForm() {
  const [firstName, setFirstName] = useState('John')
  const [lastName, setLastName] = useState('Doe')
  const [fullName, setFullName] = useState('') // Зайвий стан

  // Погано: синхронізація через ефект
  useEffect(() => {
    setFullName(firstName + ' ' + lastName)
  }, [firstName, lastName])

  return (
    <div>
      <input value={firstName} onChange={e => setFirstName(e.target.value)} />
      <input value={lastName} onChange={e => setLastName(e.target.value)} />
      <p>Full name: {fullName}</p>
    </div>
  )
}
```

### ✅ Correct (миттєве вирахування похідного значення):
Жодних ефектів, жодного додаткового стану. Значення `fullName` завжди актуальне та вираховується "на льоту" під час рендерингу за мікросекунди без запуску повторних циклів оновлення інтерфейсу.

```tsx
import React, { useState } from 'react'

function UserForm() {
  const [firstName, setFirstName] = useState('John')
  const [lastName, setLastName] = useState('Doe')
  
  // Добре: обчислюється миттєво під час кожного рендеру
  const fullName = `${firstName} ${lastName}`

  return (
    <div>
      <input value={firstName} onChange={e => setFirstName(e.target.value)} />
      <input value={lastName} onChange={e => setLastName(e.target.value)} />
      <p>Full name: {fullName}</p>
    </div>
  )
}
```

---

## 6. Use useRef for Transient Values (Використання useRef для транзитних значень)

Якщо значення змінюється надзвичайно часто (наприклад, координати миші, позиція скролу, стан таймера або лічильника інтервалів) і зміна цього значення не повинна безпосередньо ініціювати оновлення та перемальовування всього JSX-дерева додатку — зберігайте його в `useRef` замість `useState`. Це дозволяє уникнути падіння продуктивності (render thrashing). Мутація рефу (`ref.current = newValue`) не ініціює рендеринг компонентів.

### ❌ Incorrect (використання useState для трекінгу миші призводить до тисяч рендерів за секунду):
Компонент та всі його дочірні вузли рендеряться при кожному найменшому русі курсора миші. Віртуальний DOM завантажує процесор на 100%.

```tsx
import React, { useState, useEffect } from 'react'

function Tracker() {
  const [lastX, setLastX] = useState(0)

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setLastX(e.clientX) // Провокує глобальний ререндер кожні кілька мікросекунд!
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div 
      className="tracker-dot"
      style={{ position: 'fixed', left: lastX, top: 100, width: 10, height: 10, background: 'red' }} 
    />
  )
}
```

### ✅ Correct (використання useRef для транзитного стану та пряма мутація DOM-вузла):
Зміна `lastXRef.current` відбувається безшумно для React. Ми самостійно та миттєво оновлюємо стиль DOM-елемента в обхід важкого циклу звірки React Virtual DOM, зберігаючи 60fps/120fps навіть на слабких мобільних пристроях.

```tsx
import React, { useEffect, useRef } from 'react'

function Tracker() {
  const lastXRef = useRef<number>(0)
  const dotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      lastXRef.current = e.clientX // Записуємо значення без ініціації рендерингу
      
      // Пряма швидка мутація стилю DOM-вузла
      if (dotRef.current) {
        dotRef.current.style.transform = `translateX(${e.clientX}px)`
      }
    }
    
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div
      ref={dotRef}
      className="tracker-dot"
      style={{
        position: 'fixed',
        top: 100,
        left: 0,
        width: 10,
        height: 10,
        background: 'green',
        transform: 'translateX(0px)', // Використовуємо transform для GPU-прискорення
        willChange: 'transform'
      }}
    />
  )
}
```
