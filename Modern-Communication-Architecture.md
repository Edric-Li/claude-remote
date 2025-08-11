# AI Orchestra - 现代化通信架构重构设计

## 1. 需求分析

### 1.1 系统通信特征分析

#### 通信模式

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Web Client  │    │   Gateway   │    │   Agents    │
│             │    │  Cluster    │    │   Pool      │
│ • SPA应用   │    │             │    │             │
│ • 实时交互  │◀──▶│ • 负载均衡  │◀──▶│ • 分布式    │
│ • 状态同步  │    │ • 协议转换  │    │ • 异构环境  │
│             │    │ • 服务发现  │    │ • 动态伸缩  │
└─────────────┘    └─────────────┘    └─────────────┘
```

#### 数据流特征

- **控制流**: 低频、高可靠 (用户操作、配置变更)
- **状态流**: 高频、实时性 (Agent状态、任务进度)
- **数据流**: 大量、流式 (AI对话、文件传输)
- **事件流**: 异步、发布订阅 (系统事件、通知)

#### 性能需求

- **延迟要求**: 控制命令<100ms，数据流<500ms，状态更新<50ms
- **吞吐量**: 10K连接，1M消息/分钟，100MB/s数据流
- **可用性**: 99.9%+ 服务可用性，RPO<1min，RTO<5min

---

## 2. 技术选型对比

### 2.1 协议层选择

#### A. HTTP/3 + Server-Sent Events

**优势**:

- 基于QUIC，内置多路复用和拥塞控制
- 原生支持0-RTT连接恢复
- 更好的移动网络支持
- 标准化程度高

**劣势**:

- 客户端支持还在完善中
- NAT友好性待验证
- 调试工具生态不够成熟

#### B. gRPC + HTTP/2

**优势**:

- 强类型接口定义(Protocol Buffers)
- 内置负载均衡和服务发现
- 双向流支持
- 多语言生态完善

**劣势**:

- Web浏览器支持有限(需要grpc-web代理)
- 二进制协议调试复杂
- 防火墙友好性一般

#### C. WebSocket + HTTP/2

**优势**:

- 浏览器原生支持
- 全双工通信
- 协议简单，生态成熟
- 调试工具完善

**劣势**:

- 连接状态管理复杂
- 缺乏内置的服务发现机制
- 扩展性依赖额外组件

### 2.2 推荐方案：混合架构

```
Web Client           Gateway              Agent Pool
    │                   │                     │
    ├─ HTTP/3 API ─────▶│                     │
    ├─ WebSocket ──────▶│◀─── gRPC Stream ───┤
    └─ SSE ◀───────────│                     │
                       │                     │
                   ┌───▼───┐           ┌────▼────┐
                   │Message│           │ Service │
                   │ Queue │           │ Mesh    │
                   │(NATS) │           │(Consul) │
                   └───────┘           └─────────┘
```

**分层设计原则**:

- **Client Layer**: HTTP/3 API + WebSocket实时通信
- **Gateway Layer**: 协议转换 + 负载均衡 + 服务发现
- **Service Layer**: gRPC微服务 + 消息队列
- **Agent Layer**: gRPC双向流 + 心跳保活

---

## 3. 分层架构设计

### 3.1 客户端通信层 (Client Communication Layer)

#### 3.1.1 API客户端设计

```typescript
// 统一的API客户端接口
interface ApiClient {
  // HTTP API - 用于CRUD操作
  readonly rest: RestApiClient
  // 实时通信 - 用于状态订阅
  readonly realtime: RealtimeClient
  // 流式传输 - 用于大数据传输
  readonly stream: StreamApiClient
}

// HTTP/3 RESTful API客户端
class RestApiClient {
  private readonly baseURL: string
  private readonly httpClient: Http3Client

  async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    // 自动重试、超时控制、错误处理
    return this.httpClient.request({
      ...config,
      timeout: config.timeout ?? 10000,
      retries: config.retries ?? 3,
      backoff: 'exponential'
    })
  }
}

// WebSocket实时客户端
class RealtimeClient {
  private connection: ReconnectingWebSocket
  private subscriptions = new Map<string, EventHandler>()

  subscribe<T>(topic: string, handler: EventHandler<T>): Subscription {
    // 自动订阅管理、连接恢复时重新订阅
    return this.connection.subscribe(topic, handler)
  }

  publish(topic: string, data: any): Promise<void> {
    // 消息确认、重复检测
    return this.connection.publish(topic, data)
  }
}

// 流式API客户端
class StreamApiClient {
  async createStream<T>(endpoint: string, options: StreamOptions): Promise<ReadableStream<T>> {
    // 使用Fetch Streams API
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(options),
      headers: { Accept: 'application/x-ndjson' }
    })

    return response.body.pipeThrough(new TextDecoderStream()).pipeThrough(new NdjsonParserStream())
  }
}
```

#### 3.1.2 连接管理器

```typescript
class ConnectionManager {
  private connections = new Map<string, Connection>()
  private healthChecker: HealthChecker

  async connect(config: ConnectionConfig): Promise<Connection> {
    const connection = await this.createConnection(config)

    // 连接健康监控
    this.healthChecker.monitor(connection, {
      pingInterval: 30000,
      pongTimeout: 10000,
      maxMissedPings: 3
    })

    return connection
  }

  private async createConnection(config: ConnectionConfig): Promise<Connection> {
    // 根据配置选择最优协议
    const protocol = await this.selectOptimalProtocol(config)

    switch (protocol) {
      case 'websocket':
        return new WebSocketConnection(config)
      case 'sse':
        return new SseConnection(config)
      case 'grpc-web':
        return new GrpcWebConnection(config)
      default:
        throw new Error(`Unsupported protocol: ${protocol}`)
    }
  }

  private async selectOptimalProtocol(config: ConnectionConfig): Promise<string> {
    // 网络环境检测 + 协议能力检测
    const capabilities = await this.detectNetworkCapabilities()

    if (capabilities.http3 && config.preferHttp3) {
      return 'http3'
    }
    if (capabilities.websocket && config.requireBidirectional) {
      return 'websocket'
    }
    return 'sse' // 最广泛兼容的降级选项
  }
}
```

### 3.2 网关层 (Gateway Layer)

#### 3.2.1 API网关设计

```go
// 使用Go实现高性能网关
package gateway

type Gateway struct {
    router      *gin.Engine
    registry    ServiceRegistry
    loadbalancer LoadBalancer
    rateLimiter RateLimiter
    metrics     MetricsCollector
}

func (g *Gateway) Start() error {
    // WebSocket升级处理
    g.router.GET("/ws", g.handleWebSocket)

    // HTTP/3 API代理
    g.router.Any("/api/*path", g.proxyToBackend)

    // gRPC-Web代理
    g.router.POST("/grpc/*service", g.proxyToGrpc)

    return g.router.RunTLS(":8443", "cert.pem", "key.pem")
}

func (g *Gateway) handleWebSocket(c *gin.Context) {
    // 协议升级
    conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        return
    }

    // 创建会话
    session := &WebSocketSession{
        conn: conn,
        id:   generateSessionID(),
        user: g.authenticateUser(c),
    }

    // 注册到会话管理器
    g.sessionManager.AddSession(session)

    // 消息处理循环
    go g.handleMessages(session)
}

func (g *Gateway) proxyToBackend(c *gin.Context) {
    // 服务发现
    service := g.registry.Discover(c.Param("service"))
    if service == nil {
        c.JSON(404, gin.H{"error": "Service not found"})
        return
    }

    // 负载均衡
    backend := g.loadbalancer.SelectBackend(service)

    // 反向代理
    proxy := httputil.NewSingleHostReverseProxy(backend.URL)
    proxy.ServeHTTP(c.Writer, c.Request)

    // 指标收集
    g.metrics.RecordRequest(service.Name, c.Request.Method, c.Writer.Status())
}
```

#### 3.2.2 会话管理器

```go
type SessionManager struct {
    sessions sync.Map // sessionID -> Session
    topics   sync.Map // topic -> []sessionID
    redis    *redis.Client
}

func (sm *SessionManager) Subscribe(sessionID string, topic string) error {
    // 本地订阅
    sm.addTopicSubscription(topic, sessionID)

    // 集群同步
    return sm.redis.SAdd(ctx, "topic:"+topic, sessionID).Err()
}

func (sm *SessionManager) Broadcast(topic string, message []byte) error {
    // 获取订阅者
    subscribers, _ := sm.topics.Load(topic)
    if subscribers == nil {
        return nil
    }

    // 批量发送
    for _, sessionID := range subscribers.([]string) {
        if session, ok := sm.sessions.Load(sessionID); ok {
            go session.(*WebSocketSession).Send(message)
        }
    }

    // 跨节点广播
    return sm.redis.Publish(ctx, "broadcast:"+topic, message).Err()
}
```

### 3.3 服务层 (Service Layer)

#### 3.3.1 gRPC微服务设计

```protobuf
// agent_service.proto
syntax = "proto3";

package ai_orchestra;

service AgentService {
  // Agent注册和心跳
  rpc RegisterAgent(RegisterAgentRequest) returns (RegisterAgentResponse);
  rpc Heartbeat(stream HeartbeatRequest) returns (stream HeartbeatResponse);

  // 任务管理
  rpc AssignTask(AssignTaskRequest) returns (AssignTaskResponse);
  rpc TaskStream(stream TaskMessage) returns (stream TaskMessage);

  // 状态查询
  rpc ListAgents(ListAgentsRequest) returns (ListAgentsResponse);
  rpc GetAgentStatus(GetAgentStatusRequest) returns (GetAgentStatusResponse);
}

message Agent {
  string id = 1;
  string name = 2;
  repeated string capabilities = 3;
  AgentStatus status = 4;
  google.protobuf.Timestamp last_heartbeat = 5;
  AgentMetrics metrics = 6;
}

message TaskMessage {
  string task_id = 1;
  string agent_id = 2;
  TaskType type = 3;
  google.protobuf.Any payload = 4;
  google.protobuf.Timestamp timestamp = 5;
}

enum AgentStatus {
  AGENT_STATUS_UNKNOWN = 0;
  AGENT_STATUS_ONLINE = 1;
  AGENT_STATUS_BUSY = 2;
  AGENT_STATUS_OFFLINE = 3;
  AGENT_STATUS_ERROR = 4;
}
```

#### 3.3.2 服务实现

```go
type AgentServiceImpl struct {
    agentStore   AgentStore
    taskQueue    TaskQueue
    eventBus     EventBus
    metrics      MetricsCollector
}

func (s *AgentServiceImpl) RegisterAgent(
    ctx context.Context,
    req *pb.RegisterAgentRequest,
) (*pb.RegisterAgentResponse, error) {
    // 验证Agent身份
    if err := s.validateAgent(req); err != nil {
        return nil, status.Errorf(codes.Unauthenticated, "Invalid agent: %v", err)
    }

    // 创建Agent记录
    agent := &Agent{
        ID:           req.AgentId,
        Name:         req.Name,
        Capabilities: req.Capabilities,
        Status:       AgentStatusOnline,
        RegisteredAt: time.Now(),
    }

    // 持久化存储
    if err := s.agentStore.Save(agent); err != nil {
        return nil, status.Errorf(codes.Internal, "Failed to save agent: %v", err)
    }

    // 发布事件
    s.eventBus.Publish("agent.registered", agent)

    return &pb.RegisterAgentResponse{
        Success: true,
        AgentId: agent.ID,
    }, nil
}

func (s *AgentServiceImpl) TaskStream(
    stream pb.AgentService_TaskStreamServer,
) error {
    ctx := stream.Context()

    // 获取Agent ID从context
    agentID := GetAgentIDFromContext(ctx)
    if agentID == "" {
        return status.Error(codes.Unauthenticated, "Agent ID required")
    }

    // 创建双向通道
    sendChan := make(chan *pb.TaskMessage, 100)
    recvChan := make(chan *pb.TaskMessage, 100)

    // 启动接收goroutine
    go func() {
        for {
            msg, err := stream.Recv()
            if err != nil {
                close(recvChan)
                return
            }
            recvChan <- msg
        }
    }()

    // 启动发送goroutine
    go func() {
        for msg := range sendChan {
            if err := stream.Send(msg); err != nil {
                return
            }
        }
    }()

    // 消息处理循环
    for {
        select {
        case msg := <-recvChan:
            if err := s.handleAgentMessage(agentID, msg); err != nil {
                log.Printf("Error handling agent message: %v", err)
            }

        case task := <-s.taskQueue.Subscribe(agentID):
            sendChan <- &pb.TaskMessage{
                TaskId:  task.ID,
                AgentId: agentID,
                Type:    task.Type,
                Payload: task.Payload,
            }

        case <-ctx.Done():
            return ctx.Err()
        }
    }
}
```

### 3.4 消息队列层 (Message Queue Layer)

#### 3.4.1 NATS JetStream消息系统

```go
// 使用NATS JetStream作为消息中间件
type MessageBus struct {
    nc *nats.Conn
    js nats.JetStreamContext
}

func NewMessageBus(servers string) (*MessageBus, error) {
    nc, err := nats.Connect(servers)
    if err != nil {
        return nil, err
    }

    js, err := nc.JetStream()
    if err != nil {
        return nil, err
    }

    // 创建流
    streams := []StreamConfig{
        {Name: "TASKS", Subjects: []string{"tasks.>"}},
        {Name: "EVENTS", Subjects: []string{"events.>"}},
        {Name: "METRICS", Subjects: []string{"metrics.>"}},
    }

    for _, config := range streams {
        _, err := js.AddStream(&nats.StreamConfig{
            Name:     config.Name,
            Subjects: config.Subjects,
            Storage:  nats.FileStorage,
            MaxAge:   24 * time.Hour,
        })
        if err != nil {
            return nil, err
        }
    }

    return &MessageBus{nc: nc, js: js}, nil
}

func (mb *MessageBus) PublishTask(agentID string, task *Task) error {
    data, err := proto.Marshal(task)
    if err != nil {
        return err
    }

    subject := fmt.Sprintf("tasks.%s", agentID)
    _, err = mb.js.Publish(subject, data, nats.MsgId(task.ID))
    return err
}

func (mb *MessageBus) SubscribeToTasks(agentID string, handler TaskHandler) error {
    subject := fmt.Sprintf("tasks.%s", agentID)

    _, err := mb.js.Subscribe(subject, func(msg *nats.Msg) {
        var task Task
        if err := proto.Unmarshal(msg.Data, &task); err != nil {
            log.Printf("Failed to unmarshal task: %v", err)
            return
        }

        if err := handler(&task); err != nil {
            log.Printf("Task handler error: %v", err)
            // 不确认消息，触发重试
            return
        }

        msg.Ack()
    }, nats.Durable("agent-"+agentID))

    return err
}
```

#### 3.4.2 事件驱动架构

```go
type EventBus struct {
    handlers map[string][]EventHandler
    mu       sync.RWMutex
    nats     *MessageBus
}

func (eb *EventBus) Subscribe(eventType string, handler EventHandler) {
    eb.mu.Lock()
    defer eb.mu.Unlock()

    eb.handlers[eventType] = append(eb.handlers[eventType], handler)
}

func (eb *EventBus) Publish(eventType string, data interface{}) error {
    // 本地处理
    eb.mu.RLock()
    handlers := eb.handlers[eventType]
    eb.mu.RUnlock()

    for _, handler := range handlers {
        go func(h EventHandler) {
            if err := h(data); err != nil {
                log.Printf("Event handler error: %v", err)
            }
        }(handler)
    }

    // 跨服务传播
    event := &Event{
        Type:      eventType,
        Data:      data,
        Timestamp: time.Now(),
        ID:        generateEventID(),
    }

    return eb.nats.PublishEvent(event)
}
```

---

## 4. 协议和消息格式设计

### 4.1 统一消息格式

#### 4.1.1 Protocol Buffers定义

```protobuf
// common.proto - 通用消息格式
syntax = "proto3";

package ai_orchestra.common;

// 统一消息封装
message Message {
  MessageHeader header = 1;
  google.protobuf.Any payload = 2;
}

message MessageHeader {
  string id = 1;                                    // 消息唯一ID
  string correlation_id = 2;                        // 关联ID（用于请求-响应匹配）
  MessageType type = 3;                            // 消息类型
  google.protobuf.Timestamp timestamp = 4;         // 时间戳
  string source = 5;                               // 发送方标识
  string destination = 6;                          // 接收方标识
  map<string, string> metadata = 7;               // 元数据
  uint32 version = 8;                              // 协议版本
}

enum MessageType {
  MESSAGE_TYPE_UNKNOWN = 0;
  MESSAGE_TYPE_REQUEST = 1;
  MESSAGE_TYPE_RESPONSE = 2;
  MESSAGE_TYPE_EVENT = 3;
  MESSAGE_TYPE_STREAM = 4;
}

// 通用响应格式
message Response {
  bool success = 1;
  string message = 2;
  ErrorInfo error = 3;
  google.protobuf.Any data = 4;
}

message ErrorInfo {
  string code = 1;
  string message = 2;
  repeated string details = 3;
  google.protobuf.Struct context = 4;
}
```

#### 4.1.2 JSON Schema定义（Web客户端）

```typescript
// 类型安全的消息格式
interface Message<T = any> {
  readonly header: MessageHeader
  readonly payload: T
}

interface MessageHeader {
  readonly id: string
  readonly correlationId?: string
  readonly type: MessageType
  readonly timestamp: string // ISO 8601
  readonly source: string
  readonly destination?: string
  readonly metadata?: Record<string, string>
  readonly version: number
}

enum MessageType {
  REQUEST = 'REQUEST',
  RESPONSE = 'RESPONSE',
  EVENT = 'EVENT',
  STREAM = 'STREAM'
}

// 具体消息类型
interface TaskAssignmentMessage extends Message<TaskAssignmentPayload> {
  header: MessageHeader & { type: MessageType.REQUEST }
}

interface TaskProgressEvent extends Message<TaskProgressPayload> {
  header: MessageHeader & { type: MessageType.EVENT }
}

interface StreamDataMessage extends Message<StreamDataPayload> {
  header: MessageHeader & { type: MessageType.STREAM }
}
```

### 4.2 协议栈设计

#### 4.2.1 分层协议

```
┌─────────────────┐
│  Application    │  业务逻辑层 (Task, Agent, User APIs)
├─────────────────┤
│  Message        │  消息格式层 (Protocol Buffers/JSON)
├─────────────────┤
│  Transport      │  传输协议层 (gRPC/WebSocket/HTTP/3)
├─────────────────┤
│  Session        │  会话管理层 (Connection Pool/Load Balancer)
├─────────────────┤
│  Network        │  网络协议层 (TCP/UDP/QUIC)
└─────────────────┘
```

#### 4.2.2 协议适配器

```typescript
// 协议无关的抽象接口
interface TransportAdapter {
  connect(config: ConnectionConfig): Promise<Connection>
  send(connection: Connection, message: Message): Promise<void>
  receive(connection: Connection): AsyncIterableIterator<Message>
  close(connection: Connection): Promise<void>
}

// WebSocket适配器
class WebSocketAdapter implements TransportAdapter {
  async connect(config: ConnectionConfig): Promise<WebSocketConnection> {
    const ws = new WebSocket(config.url, config.protocols)

    return new Promise((resolve, reject) => {
      ws.onopen = () => resolve(new WebSocketConnection(ws))
      ws.onerror = reject

      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    })
  }

  async send(connection: WebSocketConnection, message: Message): Promise<void> {
    const data = this.serialize(message)
    connection.websocket.send(data)
  }

  async *receive(connection: WebSocketConnection): AsyncIterableIterator<Message> {
    const ws = connection.websocket

    while (ws.readyState === WebSocket.OPEN) {
      const data = await new Promise<string>((resolve, reject) => {
        ws.onmessage = event => resolve(event.data)
        ws.onerror = reject
      })

      yield this.deserialize(data)
    }
  }
}

// gRPC适配器
class GrpcAdapter implements TransportAdapter {
  private client: GrpcServiceClient

  async connect(config: ConnectionConfig): Promise<GrpcConnection> {
    this.client = new GrpcServiceClient(config.url, {
      'grpc.keepalive_time_ms': 30000,
      'grpc.keepalive_timeout_ms': 10000,
      'grpc.keepalive_permit_without_calls': true
    })

    return new GrpcConnection(this.client)
  }

  async send(connection: GrpcConnection, message: Message): Promise<void> {
    const stream = connection.getStream()
    stream.write(this.toProtobuf(message))
  }
}
```

---

## 5. 可靠性和性能方案

### 5.1 容错和恢复机制

#### 5.1.1 Circuit Breaker模式

```go
type CircuitBreaker struct {
    maxFailures int
    resetTimeout time.Duration

    failures int
    state    CircuitState
    lastFailureTime time.Time
    mu       sync.RWMutex
}

type CircuitState int

const (
    StateClosed CircuitState = iota
    StateHalfOpen
    StateOpen
)

func (cb *CircuitBreaker) Call(fn func() error) error {
    cb.mu.RLock()
    state := cb.state
    failures := cb.failures
    cb.mu.RUnlock()

    if state == StateOpen {
        if time.Since(cb.lastFailureTime) > cb.resetTimeout {
            cb.mu.Lock()
            cb.state = StateHalfOpen
            cb.mu.Unlock()
        } else {
            return ErrCircuitBreakerOpen
        }
    }

    err := fn()

    cb.mu.Lock()
    defer cb.mu.Unlock()

    if err != nil {
        cb.failures++
        cb.lastFailureTime = time.Now()

        if cb.failures >= cb.maxFailures {
            cb.state = StateOpen
        }
    } else {
        cb.failures = 0
        cb.state = StateClosed
    }

    return err
}
```

#### 5.1.2 自适应重试机制

```typescript
class AdaptiveRetryPolicy {
  private baseDelay = 100
  private maxDelay = 30000
  private backoffMultiplier = 2
  private jitterFactor = 0.1

  async retry<T>(operation: () => Promise<T>, maxAttempts: number = 5): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        if (!this.shouldRetry(error, attempt)) {
          throw error
        }

        if (attempt < maxAttempts) {
          const delay = this.calculateDelay(attempt, error)
          await this.sleep(delay)
        }
      }
    }

    throw lastError!
  }

  private shouldRetry(error: Error, attempt: number): boolean {
    // 根据错误类型和尝试次数决定是否重试
    if (error instanceof NetworkError) {
      return true
    }

    if (error instanceof TimeoutError && attempt <= 3) {
      return true
    }

    if (error instanceof ServiceUnavailableError) {
      return true
    }

    return false
  }

  private calculateDelay(attempt: number, error: Error): number {
    // 基础指数退避
    let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1)

    // 根据错误类型调整延迟
    if (error instanceof RateLimitError) {
      const retryAfter = error.retryAfter || 1000
      delay = Math.max(delay, retryAfter)
    }

    // 添加抖动
    const jitter = delay * this.jitterFactor * Math.random()
    delay += jitter

    return Math.min(delay, this.maxDelay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

#### 5.1.3 优雅降级

```typescript
class ServiceMesh {
  private services = new Map<string, ServiceEndpoint[]>()
  private healthChecker = new HealthChecker()

  async callService<T>(
    serviceName: string,
    method: string,
    params: any,
    options: CallOptions = {}
  ): Promise<T> {
    const endpoints = this.getHealthyEndpoints(serviceName)

    if (endpoints.length === 0) {
      // 降级处理
      return this.callFallback(serviceName, method, params, options)
    }

    const endpoint = this.selectEndpoint(endpoints, options.strategy)

    try {
      return await this.makeRequest(endpoint, method, params, options)
    } catch (error) {
      // 标记端点不健康
      this.healthChecker.markUnhealthy(endpoint)

      // 尝试其他端点
      const remainingEndpoints = endpoints.filter(e => e !== endpoint)
      if (remainingEndpoints.length > 0) {
        return this.callService(serviceName, method, params, options)
      }

      // 所有端点都失败，使用降级策略
      return this.callFallback(serviceName, method, params, options)
    }
  }

  private async callFallback<T>(
    serviceName: string,
    method: string,
    params: any,
    options: CallOptions
  ): Promise<T> {
    // 缓存降级
    const cachedResult = await this.getCachedResponse(serviceName, method, params)
    if (cachedResult) {
      return cachedResult
    }

    // 静态响应降级
    const staticResponse = this.getStaticFallback(serviceName, method)
    if (staticResponse) {
      return staticResponse
    }

    // 默认值降级
    return this.getDefaultResponse(serviceName, method) as T
  }
}
```

### 5.2 性能优化方案

#### 5.2.1 连接池和多路复用

```go
type ConnectionPool struct {
    mu          sync.RWMutex
    connections map[string][]*Connection
    maxSize     int
    minIdle     int
    maxIdle     time.Duration
}

func (pool *ConnectionPool) GetConnection(target string) (*Connection, error) {
    pool.mu.RLock()
    conns, exists := pool.connections[target]
    pool.mu.RUnlock()

    if exists {
        // 寻找空闲连接
        for _, conn := range conns {
            if conn.TryAcquire() {
                return conn, nil
            }
        }
    }

    // 创建新连接
    if len(conns) < pool.maxSize {
        conn, err := pool.createConnection(target)
        if err != nil {
            return nil, err
        }

        pool.mu.Lock()
        pool.connections[target] = append(conns, conn)
        pool.mu.Unlock()

        conn.Acquire()
        return conn, nil
    }

    // 等待连接可用
    return pool.waitForConnection(target)
}

type MultiplexedConnection struct {
    transport Transport
    streams   sync.Map // streamID -> Stream
    nextID    uint32
    mu        sync.Mutex
}

func (mc *MultiplexedConnection) CreateStream() (*Stream, error) {
    mc.mu.Lock()
    streamID := atomic.AddUint32(&mc.nextID, 1)
    mc.mu.Unlock()

    stream := &Stream{
        ID:         streamID,
        connection: mc,
        sendChan:   make(chan []byte, 100),
        recvChan:   make(chan []byte, 100),
    }

    mc.streams.Store(streamID, stream)
    return stream, nil
}
```

#### 5.2.2 消息批处理和压缩

```typescript
class MessageBatcher {
  private batches = new Map<string, BatchItem[]>()
  private timers = new Map<string, NodeJS.Timeout>()

  private maxBatchSize = 100
  private maxWaitTime = 50 // 50ms

  addMessage(destination: string, message: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      const batchItem: BatchItem = { message, resolve, reject }

      if (!this.batches.has(destination)) {
        this.batches.set(destination, [])
      }

      const batch = this.batches.get(destination)!
      batch.push(batchItem)

      // 检查是否需要立即发送
      if (batch.length >= this.maxBatchSize) {
        this.flushBatch(destination)
      } else if (batch.length === 1) {
        // 第一条消息，设置定时器
        const timer = setTimeout(() => {
          this.flushBatch(destination)
        }, this.maxWaitTime)

        this.timers.set(destination, timer)
      }
    })
  }

  private async flushBatch(destination: string) {
    const batch = this.batches.get(destination)
    if (!batch || batch.length === 0) return

    // 清理状态
    this.batches.delete(destination)
    const timer = this.timers.get(destination)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(destination)
    }

    try {
      // 创建批处理消息
      const batchMessage = this.createBatchMessage(batch.map(b => b.message))

      // 压缩消息
      const compressedMessage = await this.compressMessage(batchMessage)

      // 发送批处理消息
      await this.transport.send(destination, compressedMessage)

      // 通知所有Promise成功
      batch.forEach(item => item.resolve())
    } catch (error) {
      // 通知所有Promise失败
      batch.forEach(item => item.reject(error))
    }
  }

  private async compressMessage(message: BatchMessage): Promise<CompressedMessage> {
    const serialized = JSON.stringify(message)

    if (serialized.length < 1024) {
      // 小消息不压缩
      return { compressed: false, data: serialized }
    }

    const compressed = await gzip(serialized)
    const compressionRatio = compressed.length / serialized.length

    if (compressionRatio > 0.8) {
      // 压缩效果不好，使用原始数据
      return { compressed: false, data: serialized }
    }

    return {
      compressed: true,
      algorithm: 'gzip',
      data: compressed.toString('base64'),
      originalSize: serialized.length
    }
  }
}
```

#### 5.2.3 智能路由和负载均衡

```go
type LoadBalancer struct {
    strategy BalancingStrategy
    backends []Backend
    metrics  *MetricsCollector
}

type Backend struct {
    ID       string
    Endpoint string
    Weight   int
    Health   HealthStatus
    Metrics  BackendMetrics
}

type BackendMetrics struct {
    Latency          time.Duration
    RequestCount     int64
    ErrorCount       int64
    ActiveRequests   int32
    CPU              float64
    Memory           float64
}

func (lb *LoadBalancer) SelectBackend(request *Request) *Backend {
    switch lb.strategy {
    case StrategyRoundRobin:
        return lb.roundRobinSelect()
    case StrategyWeightedRoundRobin:
        return lb.weightedRoundRobinSelect()
    case StrategyLeastConnections:
        return lb.leastConnectionsSelect()
    case StrategyLatencyBased:
        return lb.latencyBasedSelect()
    case StrategyResourceBased:
        return lb.resourceBasedSelect()
    case StrategyConsistentHash:
        return lb.consistentHashSelect(request.UserID)
    default:
        return lb.randomSelect()
    }
}

func (lb *LoadBalancer) latencyBasedSelect() *Backend {
    healthyBackends := lb.getHealthyBackends()
    if len(healthyBackends) == 0 {
        return nil
    }

    // 使用指数加权移动平均计算延迟权重
    type weightedBackend struct {
        backend *Backend
        weight  float64
    }

    var candidates []weightedBackend
    minLatency := time.Duration(math.MaxInt64)

    for _, backend := range healthyBackends {
        latency := backend.Metrics.Latency
        if latency < minLatency {
            minLatency = latency
        }
    }

    for _, backend := range healthyBackends {
        // 延迟越低权重越高
        weight := float64(minLatency) / float64(backend.Metrics.Latency)

        // 考虑当前负载
        loadFactor := 1.0 - (float64(backend.Metrics.ActiveRequests) / 100.0)
        weight *= math.Max(loadFactor, 0.1)

        candidates = append(candidates, weightedBackend{backend, weight})
    }

    // 加权随机选择
    return lb.weightedRandomSelect(candidates)
}

func (lb *LoadBalancer) resourceBasedSelect() *Backend {
    healthyBackends := lb.getHealthyBackends()
    if len(healthyBackends) == 0 {
        return nil
    }

    bestBackend := healthyBackends[0]
    bestScore := lb.calculateResourceScore(bestBackend)

    for _, backend := range healthyBackends[1:] {
        score := lb.calculateResourceScore(backend)
        if score > bestScore {
            bestScore = score
            bestBackend = backend
        }
    }

    return bestBackend
}

func (lb *LoadBalancer) calculateResourceScore(backend *Backend) float64 {
    metrics := backend.Metrics

    // 计算综合评分 (0-1，越高越好)
    cpuScore := 1.0 - metrics.CPU/100.0
    memoryScore := 1.0 - metrics.Memory/100.0
    latencyScore := 1.0 / (1.0 + float64(metrics.Latency.Milliseconds())/1000.0)
    loadScore := 1.0 / (1.0 + float64(metrics.ActiveRequests)/10.0)

    // 加权平均
    score := 0.3*cpuScore + 0.3*memoryScore + 0.25*latencyScore + 0.15*loadScore

    return score
}
```

---

## 6. 部署架构

### 6.1 微服务部署

#### 6.1.1 Kubernetes部署清单

```yaml
# API网关部署
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    spec:
      containers:
        - name: gateway
          image: ai-orchestra/gateway:latest
          ports:
            - containerPort: 8080
            - containerPort: 8443
          env:
            - name: NATS_URL
              value: 'nats://nats:4222'
            - name: REDIS_URL
              value: 'redis://redis:6379'
          resources:
            requests:
              memory: '128Mi'
              cpu: '100m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
---
# Agent服务部署
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agent-service
  template:
    spec:
      containers:
        - name: agent-service
          image: ai-orchestra/agent-service:latest
          ports:
            - containerPort: 9090
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: url
            - name: NATS_URL
              value: 'nats://nats:4222'
          resources:
            requests:
              memory: '256Mi'
              cpu: '200m'
            limits:
              memory: '1Gi'
              cpu: '1'
---
# 服务网格 (Istio)
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ai-orchestra-routing
spec:
  http:
    - match:
        - uri:
            prefix: '/api/v1'
      route:
        - destination:
            host: api-gateway
            port:
              number: 8080
          weight: 100
      fault:
        delay:
          percentage:
            value: 0.1
          fixedDelay: 5s
      retries:
        attempts: 3
        perTryTimeout: 2s
```

#### 6.1.2 容器化配置

```dockerfile
# API网关容器
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o gateway ./cmd/gateway

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/gateway .
COPY --from=builder /app/configs ./configs

EXPOSE 8080 8443

CMD ["./gateway"]
```

### 6.2 监控和可观测性

#### 6.2.1 Prometheus监控配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - 'ai_orchestra_rules.yml'

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['gateway:8080']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'agent-service'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: agent-service

  - job_name: 'nats'
    static_configs:
      - targets: ['nats:8222']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093
```

#### 6.2.2 分布式追踪

```go
// OpenTelemetry集成
func initTracing() {
    exporter, err := jaeger.New(jaeger.WithCollectorEndpoint(
        jaeger.WithEndpoint("http://jaeger:14268/api/traces"),
    ))
    if err != nil {
        log.Fatal(err)
    }

    tp := tracesdk.NewTracerProvider(
        tracesdk.WithBatcher(exporter),
        tracesdk.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String("ai-orchestra-gateway"),
            semconv.ServiceVersionKey.String("1.0.0"),
        )),
    )

    otel.SetTracerProvider(tp)
    otel.SetTextMapPropagator(propagation.TraceContext{})
}

// 中间件集成
func TracingMiddleware() gin.HandlerFunc {
    return gin.HandlerFunc(func(c *gin.Context) {
        tracer := otel.Tracer("gateway")

        ctx, span := tracer.Start(c.Request.Context(), c.Request.URL.Path)
        defer span.End()

        // 注入trace context
        c.Request = c.Request.WithContext(ctx)

        // 设置span属性
        span.SetAttributes(
            attribute.String("http.method", c.Request.Method),
            attribute.String("http.url", c.Request.URL.String()),
            attribute.String("user.id", GetUserID(c)),
        )

        c.Next()

        // 记录响应状态
        span.SetAttributes(attribute.Int("http.status_code", c.Writer.Status()))
        if c.Writer.Status() >= 400 {
            span.SetStatus(codes.Error, "HTTP Error")
        }
    })
}
```

---

## 7. 总结和建议

### 7.1 架构优势

#### 现代化技术栈

- **HTTP/3 + gRPC**: 高性能、低延迟的现代协议
- **Protocol Buffers**: 强类型、高效序列化
- **NATS JetStream**: 高性能分布式消息系统
- **Kubernetes**: 云原生部署和扩展

#### 高可用性设计

- **多层负载均衡**: 网关层 + 服务层双重负载均衡
- **故障自愈**: Circuit Breaker + 自适应重试 + 优雅降级
- **分布式架构**: 无单点故障，水平扩展能力强

#### 性能优化

- **连接复用**: HTTP/2多路复用 + gRPC流
- **智能批处理**: 自适应批量处理和压缩
- **资源感知路由**: 基于延迟和负载的智能路由

#### 可观测性

- **分布式追踪**: 完整的请求链路追踪
- **多维度监控**: 业务指标 + 系统指标 + 自定义指标
- **结构化日志**: 便于查询和分析的日志格式

### 7.2 实施建议

#### 渐进式重构路径

1. **Phase 1**: 新建API网关，保持现有服务
2. **Phase 2**: 迁移Web客户端到新协议
3. **Phase 3**: 重构后端服务为微服务
4. **Phase 4**: 部署Agent新通信协议
5. **Phase 5**: 下线旧系统组件

#### 风险控制措施

- **灰度发布**: 逐步切换用户流量
- **AB测试**: 新旧架构性能对比
- **回滚预案**: 快速回退到稳定版本
- **监控告警**: 实时监控关键指标

#### 技术债务处理

- **代码标准化**: 统一编码规范和最佳实践
- **测试覆盖**: 单元测试 + 集成测试 + 端到端测试
- **文档完善**: API文档 + 运维手册 + 故障排查指南

### 7.3 预期收益

#### 性能提升

- **延迟降低**: 50%以上延迟改善
- **吞吐量提升**: 10倍并发处理能力
- **带宽优化**: 30%带宽使用率降低

#### 可维护性改善

- **模块化架构**: 独立开发和部署
- **技术栈统一**: 降低学习和维护成本
- **自动化运维**: CI/CD + 自动扩缩容

#### 业务价值

- **用户体验**: 更快的响应速度和更稳定的服务
- **开发效率**: 更快的功能迭代和问题修复
- **运营成本**: 更低的基础设施和维护成本

这套重构架构设计为AI Orchestra提供了现代化、高性能、可扩展的通信基础设施，可以支撑未来的业务增长和技术演进需求。
