# @object-ui/plugin-chatbot

Chatbot interface plugin for Object UI with full AI SDUI support.

## Installation

```bash
npm install @object-ui/plugin-chatbot
```

## Usage

### Basic (Local/Demo Mode)

```tsx
import { Chatbot } from '@object-ui/plugin-chatbot';

function App() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! How can I help you today?'
    }
  ]);

  const handleSend = (content: string) => {
    const newMessage = {
      id: Date.now().toString(),
      role: 'user',
      content
    };
    setMessages([...messages, newMessage]);
  };

  return (
    <Chatbot
      messages={messages}
      onSendMessage={handleSend}
      placeholder="Type your message..."
    />
  );
}
```

### AI Streaming Mode (service-ai)

When `api` is set in the schema, the chatbot connects to a backend SSE endpoint
using `@ai-sdk/react` v3 (Vercel UI Message Stream protocol) for streaming,
tool-calling, and production-grade chat:

```tsx
import '@object-ui/plugin-chatbot';

const schema = {
  type: 'chatbot',
  api: '/api/v1/ai/chat',
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
  streamingEnabled: true,
  conversationId: 'conv-123',
  messages: [
    { id: '1', role: 'assistant', content: 'Hello! Ask me anything.' }
  ],
  placeholder: 'Type your message...',
};
```

### Using the `useObjectChat` Hook

For custom integrations, you can use the `useObjectChat` hook directly:

```tsx
import { useObjectChat } from '@object-ui/plugin-chatbot';

function MyChat() {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stop,
    reload,
    clear,
    isApiMode,
  } = useObjectChat({
    api: '/api/v1/ai/chat',
    model: 'gpt-4o',
    systemPrompt: 'You are helpful.',
  });

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      {isLoading && <button onClick={stop}>Stop</button>}
      {error && <button onClick={reload}>Retry</button>}
    </div>
  );
}
```

## Schema-Driven Usage

### Discovering Backend Agents

Use `useAgents` to fetch the list of agents exposed by `@objectstack/service-ai`
at `GET {apiBase}/agents`. This is what the global console FAB uses to populate
its in-header agent picker:

```tsx
import { useAgents } from '@object-ui/plugin-chatbot';

function AgentPicker() {
  const { agents, isLoading, error } = useAgents({
    apiBase: 'http://localhost:3000/api/v1/ai',
    // Optional fallback list shown when the backend is unreachable
    fallback: [{ name: 'data_chat', label: 'Data Chat' }],
  });

  if (isLoading) return <span>Loading agents…</span>;
  if (error) return <span>Backend unreachable</span>;

  return (
    <select>
      {agents.map(a => (
        <option key={a.name} value={a.name}>{a.label}</option>
      ))}
    </select>
  );
}
```

Each agent's chat endpoint is `POST {apiBase}/agents/{name}/chat` — pass that
URL as the `api` option to `useObjectChat` to talk to it.

### Console Integration

The console (`@object-ui/app-shell`) auto-mounts a global floating chatbot
when `useDiscovery().isAiEnabled` is true. Configure the backend in your
console `.env`:

```bash
# AI service endpoint (defaults to ${VITE_SERVER_URL}/api/v1/ai when unset)
VITE_AI_BASE_URL=http://localhost:3000/api/v1/ai
# Default agent to select on first open (must match an agent name returned
# by GET ${VITE_AI_BASE_URL}/agents)
VITE_AI_DEFAULT_AGENT=sales_copilot
```

The picker lets the user switch agents at runtime; switching transparently
remounts the chat hook against the new agent's `/chat` endpoint.

This plugin automatically registers with ObjectUI's component registry when imported:

```tsx
import '@object-ui/plugin-chatbot';

// Local/demo mode
const demoSchema = {
  type: 'chatbot',
  messages: [
    { id: '1', role: 'assistant', content: 'Hello!' }
  ],
  placeholder: 'Type your message...',
  autoResponse: true,
};

// AI streaming mode
const aiSchema = {
  type: 'chatbot',
  api: '/api/v1/ai/chat',
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
  streamingEnabled: true,
  messages: [],
  placeholder: 'Ask the AI...',
};
```

## Two Operating Modes

| Feature | Local/Demo Mode | AI Streaming Mode |
|---------|----------------|-------------------|
| `api` | Not set | Set to SSE endpoint |
| Responses | Auto-response (configurable) | Real AI streaming via SSE |
| Streaming | Simulated | Full SSE streaming |
| Tool calling | N/A | Supported via vercel/ai |
| Stop/Reload | Stop cancels timer | Stop interrupts stream |
| Backend | None required | service-ai (IAIService) |

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-chatbot)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-chatbot)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT © ObjectStack Inc.
