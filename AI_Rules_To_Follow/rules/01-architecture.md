# Component Architecture

Цей документ визначає фундаментальні патерни архітектури React-компонентів для масштабованих вебдодатків. Основний фокус — уникнення надлишкової конфігурації через пропси, забезпечення гнучкої композиції та побудова чистих інтерфейсів взаємодії компонентів.

---

## 1. Avoid Boolean Prop Proliferation (Уникнення накопичення булевих пропсів)

Додавання булевих пропсів (таких як `isThread`, `isEditing`, `isDMThread`, `isForwarding`) для зміни поведінки або розмітки одного монолітного компонента є критичною архітектурною помилкою. Кожен новий булевий пропс подвоює кількість можливих станів компонента ($2^n$), утворюючи комбінаторний вибух, призводячи до неможливих станів (impossible states) та заплутаних умовних рендерів. Замість цього використовуйте композицію.

### ❌ Incorrect (монолітний компонент із булевими прапорцями):
Код нижче надзвичайно складно читати, тестувати та розширювати. Логіка різних режимів роботи (гілка треду, режим редагування, режим пересилання) переплетена в одному місці.

```tsx
import React from 'react'

interface Props {
  onSubmit: () => void;
  isThread?: boolean;
  channelId?: string;
  isDMThread?: boolean;
  dmId?: string;
  isEditing?: boolean;
  isForwarding?: boolean;
}

// Заглушки для демонстрації структури
const Header = () => <header>Composer Header</header>
const Input = () => <input type="text" placeholder="Type a message..." />
const AlsoSendToDMField = ({ id }: { id?: string }) => <div>Also sending to DM: {id}</div>
const AlsoSendToChannelField = ({ id }: { id?: string }) => <div>Also sending to Channel: {id}</div>
const EditActions = () => <fieldset><button>Cancel</button><button>Save</button></fieldset>
const ForwardActions = () => <fieldset><button>Select Chats</button><button>Forward</button></fieldset>
const DefaultActions = () => <fieldset><button>Send</button></fieldset>
const Footer = ({ onSubmit }: { onSubmit: () => void }) => (
  <footer>
    <button onClick={onSubmit}>Submit</button>
  </footer>
)

function Composer({
  onSubmit,
  isThread,
  channelId,
  isDMThread,
  dmId,
  isEditing,
  isForwarding,
}: Props) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Header />
      <Input />
      
      {/* Складні вкладені умовні рендери */}
      {isDMThread ? (
        <AlsoSendToDMField id={dmId} />
      ) : isThread ? (
        <AlsoSendToChannelField id={channelId} />
      ) : null}
      
      {isEditing ? (
        <EditActions />
      ) : isForwarding ? (
        <ForwardActions />
      ) : (
        <DefaultActions />
      )}
      
      <Footer onSubmit={onSubmit} />
    </form>
  )
}
```

### ✅ Correct (композиція усуває розгалуження логіки):
Замість одного гігантського компонента ми будуємо декларативні Compound-компоненти. Кожна варіація явно описує, з яких частин вона складається. Вони можуть спільно використовувати внутрішні елементи без створення монолітного спільного батька.

```tsx
import React from 'react'

// Визначаємо спільні атомарні частини
const ComposerFrame = ({ children }: { children: React.ReactNode }) => (
  <form className="composer-frame">{children}</form>
)
const ComposerHeader = () => <header className="composer-header">Header</header>
const ComposerInput = () => <input className="composer-input" type="text" placeholder="Write something..." />
const ComposerFooter = ({ children }: { children: React.ReactNode }) => (
  <footer className="composer-footer">{children}</footer>
)
const ComposerSubmit = () => <button type="submit">Send</button>
const ComposerAttachments = () => <button type="button">Attach Files</button>
const ComposerFormatting = () => <div className="formatting-bar">Formatting Panel</div>
const ComposerEmojis = () => <button type="button">Emoji</button>
const ComposerCancelEdit = () => <button type="button">Cancel</button>
const ComposerSaveEdit = () => <button type="submit">Save Changes</button>

const AlsoSendToChannelField = ({ id }: { id: string }) => (
  <div className="channel-share-checkbox">
    <label>
      <input type="checkbox" /> Also send to channel: {id}
    </label>
  </div>
)

// 1. Стандартний композитор каналу
function ChannelComposer() {
  return (
    <ComposerFrame>
      <ComposerHeader />
      <ComposerInput />
      <ComposerFooter>
        <ComposerAttachments />
        <ComposerFormatting />
        <ComposerEmojis />
        <ComposerSubmit />
      </ComposerFooter>
    </ComposerFrame>
  )
}

// 2. Композитор для гілок обговорення (Thread) - додає специфічне поле відправки в канал
function ThreadComposer({ channelId }: { channelId: string }) {
  return (
    <ComposerFrame>
      <ComposerHeader />
      <ComposerInput />
      <AlsoSendToChannelField id={channelId} />
      <ComposerFooter>
        <ComposerFormatting />
        <ComposerEmojis />
        <ComposerSubmit />
      </ComposerFooter>
    </ComposerFrame>
  )
}

// 3. Композитор для режиму редагування повідомлення - має зовсім інші кнопки дій у футері
function EditComposer() {
  return (
    <ComposerFrame>
      <ComposerInput />
      <ComposerFooter>
        <ComposerFormatting />
        <ComposerEmojis />
        <ComposerCancelEdit />
        <ComposerSaveEdit />
      </ComposerFooter>
    </ComposerFrame>
  )
}
```

---

## 2. Use Compound Components (Використання Compound-компонентів)

Проєктуйте складні, інтерактивні інтерфейси як набори зв'язаних між собою компонентів (Compound Components), які використовують спільний контекст React. Це дозволяє уникнути прокидання пропсів (prop drilling) і дає розробникам повну свободу в конструюванні розмітки.

Кожен субкомпонент самостійно бере потрібний йому стан із контексту, а не отримує його зверху через пропси.

### ❌ Incorrect (монолітний компонент із рендер-пропсами та умовними перемикачами):
Споживачу доводиться передавати безліч функцій рендерингу та прапорців відображення, що обмежує гнучкість стилізації та структури DOM.

```tsx
import React from 'react'

interface Props {
  renderHeader?: () => React.ReactNode;
  renderFooter?: () => React.ReactNode;
  renderActions?: () => React.ReactNode;
  showAttachments?: boolean;
  showFormatting?: boolean;
  showEmojis?: boolean;
}

const Input = () => <input type="text" />
const Attachments = () => <div>Files Panel</div>
const Footer = ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>
const Formatting = () => <span>Formatting Tools</span>
const Emojis = () => <span>Emojis list</span>

function Composer({
  renderHeader,
  renderFooter,
  renderActions,
  showAttachments,
  showFormatting,
  showEmojis,
}: Props) {
  return (
    <form>
      {renderHeader?.()}
      <Input />
      {showAttachments && <Attachments />}
      {renderFooter ? (
        renderFooter()
      ) : (
        <Footer>
          {showFormatting && <Formatting />}
          {showEmojis && <Emojis />}
          {renderActions?.()}
        </Footer>
      )}
    </form>
  )
}
```

### ✅ Correct (Compound-архітектура на базі React 19):
Використовуємо нативний механізм контексту без посередників. Зверніть увагу на використання нового API React 19: робота з `use(Context)` замість `useContext` та передача `ref` як звичайного пропса.

```tsx
import React, { createContext, use, useState, useRef } from 'react'

// 1. Опис інтерфейсів контракту даних контексту
interface ComposerState {
  input: string
  attachments: string[]
}

interface ComposerActions {
  update: (updater: (s: ComposerState) => ComposerState) => void
  submit: () => void
}

interface ComposerMeta {
  inputRef: React.RefObject<HTMLInputElement | null>
}

interface ComposerContextValue {
  state: ComposerState
  actions: ComposerActions
  meta: ComposerMeta
}

// 2. Створення контексту
const ComposerContext = createContext<ComposerContextValue | null>(null)

// 3. Створення Провайдера
interface ProviderProps {
  children: React.ReactNode
  state: ComposerState
  actions: ComposerActions
  meta: ComposerMeta
}

function ComposerProvider({ children, state, actions, meta }: ProviderProps) {
  return (
    <ComposerContext value={{ state, actions, meta }}>
      {children}
    </ComposerContext>
  )
}

// 4. Базовий фрейм-контейнер форми
function ComposerFrame({ children }: { children: React.ReactNode }) {
  return <form className="composer-form-container">{children}</form>
}

// 5. Субкомпонент вводу тексту із застосуванням React 19 ref-prop
interface InputProps {
  ref?: React.Ref<HTMLInputElement>
}

function ComposerInput({ ref }: InputProps) {
  const context = use(ComposerContext) // Новий API React 19
  if (!context) {
    throw new Error('ComposerInput must be rendered within a Composer.Provider')
  }

  const { state, actions, meta } = context

  // Об'єднуємо зовнішній ref та внутрішній системний ref
  const handleRef = (node: HTMLInputElement | null) => {
    meta.inputRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
    }
  }

  return (
    <input
      ref={handleRef}
      value={state.input}
      onChange={(e) => actions.update((s) => ({ ...s, input: e.target.value }))}
      className="composer-text-field"
      placeholder="Type your message..."
    />
  )
}

// 6. Субкомпонент кнопки відправки
function ComposerSubmit() {
  const context = use(ComposerContext)
  if (!context) {
    throw new Error('ComposerSubmit must be rendered within a Composer.Provider')
  }

  return (
    <button type="button" onClick={context.actions.submit} className="submit-btn">
      Send Message
    </button>
  )
}

// Інші атомарні субкомпоненти
function ComposerHeader() { return <div className="comp-header">Composer Options</div> }
function ComposerFooter({ children }: { children: React.ReactNode }) { return <div className="comp-footer">{children}</div> }
function ComposerAttachments() { return <div className="comp-attachments">Attachments list</div> }
function ComposerFormatting() { return <div className="comp-formatting">Bold/Italic/Code</div> }
function ComposerEmojis() { return <button type="button">😃</button> }

// 7. Експорт об'єкта Compound-компонента
export const Composer = {
  Provider: ComposerProvider,
  Frame: ComposerFrame,
  Input: ComposerInput,
  Submit: ComposerSubmit,
  Header: ComposerHeader,
  Footer: ComposerFooter,
  Attachments: ComposerAttachments,
  Formatting: ComposerFormatting,
  Emojis: ComposerEmojis,
}

// --- Приклад гнучкого використання споживачем ---
function App() {
  const [state, setState] = useState<ComposerState>({ input: '', attachments: [] })
  const inputRef = useRef<HTMLInputElement | null>(null)
  
  const actions: ComposerActions = {
    update: (updater) => setState((prev) => updater(prev)),
    submit: () => {
      console.log('Submitted data:', state.input)
      setState({ input: '', attachments: [] })
    }
  }

  const meta: ComposerMeta = { inputRef }

  return (
    <Composer.Provider state={state} actions={actions} meta={meta}>
      <Composer.Frame>
        {/* Будь-який порядок розмітки, стилізація та довільна вкладеність */}
        <Composer.Header />
        
        <div className="custom-wrapper-for-input-layout">
          <Composer.Input />
        </div>
        
        <Composer.Attachments />
        
        <Composer.Footer>
          <Composer.Formatting />
          <Composer.Emojis />
          <Composer.Submit />
        </Composer.Footer>
      </Composer.Frame>
    </Composer.Provider>
  )
}
```

---

## 3. Prefer Composing Children Over Render Props (Перевага дітям перед рендер-пропсами)

Використовуйте нативний пропс `children` для композиції статичної структури лейауту замість передачі функцій рендерингу типу `renderHeader` або `renderFooter`. 

*Критерій вибору:*
*   Використовуйте **children** завжди, коли ви просто створюєте візуальну структуру, сітку або контейнер компонентів.
*   Використовуйте **render props** виключно тоді, коли батьківському компоненту необхідно передати унікальні, динамічні дані зсередини свого життєвого циклу назад у дитину (наприклад, об'єкт елемента та індекс у віртуалізованому списку: `<List renderItem={({ item, index }) => ...} />`).

### ❌ Incorrect (перевантаження рендер-пропсами):
Така конструкція створює непотрібні колбеки, захаращує код закриваючими дужками та ускладнює рефакторинг стилів.

```tsx
import React from 'react'

interface ComposerProps {
  renderHeader?: () => React.ReactNode
  renderFooter?: () => React.ReactNode
  renderActions?: () => React.ReactNode
}

const Input = () => <input type="text" />
const DefaultFooter = () => <footer>Default Footer</footer>
const CustomHeader = () => <header>My Custom Header</header>
const Formatting = () => <div>Formatting Bar</div>
const Emojis = () => <button>😀</button>
const SubmitButton = () => <button type="submit">Submit</button>

function Composer({ renderHeader, renderFooter, renderActions }: ComposerProps) {
  return (
    <form className="monolithic-composer">
      {renderHeader?.()}
      <Input />
      {renderFooter ? renderFooter() : <DefaultFooter />}
      {renderActions?.()}
    </form>
  )
}

// Використання є вкрай негнучким:
const pageElement = (
  <Composer
    renderHeader={() => <CustomHeader />}
    renderFooter={() => (
      <div className="footer-flex-row">
        <Formatting />
        <Emojis />
      </div>
    )}
    renderActions={() => <SubmitButton />}
  />
)
```

### ✅ Correct (композиція через вкладеність children):
Кожен елемент є самостійним вузлом. Батьківські компоненти просто керують обгорткою (наприклад, тегом `form` або `footer`). Це дозволяє гнучко додавати класи, нові теги, змінювати порядок рендерингу без зміни коду базових компонентів.

```tsx
import React from 'react'

// Атомарні модулі макету
function ComposerFrame({ children }: { children: React.ReactNode }) {
  return <form className="composer-form-wrapper">{children}</form>
}

function ComposerFooter({ children }: { children: React.ReactNode }) {
  return <footer className="composer-flex-footer">{children}</footer>
}

const CustomHeader = () => <header className="composer-section-header">Header Title</header>
const ComposerInput = () => <input type="text" className="standard-input" />
const ComposerFormatting = () => <div className="styling-bar">Styles Options</div>
const ComposerEmojis = () => <button type="button">😀</button>
const SubmitButton = () => <button type="submit">Submit</button>

// Використання є інтуїтивно зрозумілим, чистим та розширюваним:
const pageElement = (
  <ComposerFrame>
    <CustomHeader />
    <ComposerInput />
    
    <ComposerFooter>
      <ComposerFormatting />
      <ComposerEmojis />
      <SubmitButton />
    </ComposerFooter>
  </ComposerFrame>
)
```

---

## 4. Create Explicit Component Variants (Створення явних варіантів компонентів)

Створюйте окремі, вузькоспеціалізовані компоненти-обгортки замість одного універсального компонента, що перемикає свій вигляд залежно від десятка параметрів. 

Явно вказуйте склад кожної варіації через Compound Components. Це забезпечує принцип єдиної відповідальності (Single Responsibility Principle) та спрощує інтеграційне тестування.

### ❌ Incorrect (один компонент із прихованими умовними станами всередині):
Дивлячись на виклик цього компонента, неможливо передбачити, як саме він буде виглядати та які провайдери даних йому потрібні. Будь-яка помилка в комбінації пропсів може зламати рендеринг усього дерева.

```tsx
// Що насправді буде змонтовано у DOM у цьому режимі? 
// Які умовні гілки спрацюють? Це невідомо без повного аналізу коду Composer.
<Composer
  isThread={true}
  isEditing={false}
  channelId="channel_123"
  showAttachments={true}
  showFormatting={false}
/>
```

### ✅ Correct (явні, ізольовані та самодокументовані варіанти):
Кожен варіант чітко декларує свій провайдер стану, унікальну розмітку та набір елементів керування. Код стає очевидним для аналізу та безпечним для рефакторингу.

```tsx
import React from 'react'
import { Composer } from './Composer' // Імпортуємо наш Compound-об'єкт

// Специфічні локальні компоненти для окремих режимів
const ThreadProvider = ({ channelId, children }: { channelId: string; children: React.ReactNode }) => <div>{children}</div>
const EditMessageProvider = ({ messageId, children }: { messageId: string; children: React.ReactNode }) => <div>{children}</div>
const ForwardMessageProvider = ({ messageId, children }: { messageId: string; children: React.ReactNode }) => <div>{children}</div>
const AlsoSendToChannelField = ({ channelId }: { channelId: string }) => <label>Send to channel {channelId}</label>

// 1. Варіант: Створення повідомлення у гілці треду
function ThreadComposer({ channelId }: { channelId: string }) {
  return (
    <ThreadProvider channelId={channelId}>
      <Composer.Frame>
        <Composer.Input />
        {/* Специфічне поле для тредів */}
        <AlsoSendToChannelField channelId={channelId} />
        <Composer.Footer>
          <Composer.Formatting />
          <Composer.Emojis />
          <Composer.Submit />
        </Composer.Footer>
      </Composer.Frame>
    </ThreadProvider>
  )
}

// 2. Варіант: Редагування вже існуючого повідомлення
function EditMessageComposer({ messageId }: { messageId: string }) {
  return (
    <EditMessageProvider messageId={messageId}>
      <Composer.Frame>
        <Composer.Input />
        <Composer.Footer>
          <Composer.Formatting />
          <Composer.Emojis />
          {/* Специфічні дії замість стандартного Submit */}
          <Composer.CancelEdit />
          <Composer.SaveEdit />
        </Composer.Footer>
      </Composer.Frame>
    </EditMessageProvider>
  )
}

// 3. Варіант: Пересилання повідомлення в інший чат
function ForwardMessageComposer({ messageId }: { messageId: string }) {
  return (
    <ForwardMessageProvider messageId={messageId}>
      <Composer.Frame>
        <Composer.Input placeholder="Add a message to this forward, if you'd like..." />
        <Composer.Footer>
          <Composer.Formatting />
          <Composer.Emojis />
          {/* Додатковий компонент згадок, унікальний для пересилання */}
          <Composer.Mentions />
        </Composer.Footer>
      </Composer.Frame>
    </ForwardMessageProvider>
  )
}
```
