import { useState, useRef, useEffect } from "react";
import "./Aipermissionchat.css";
import PageLayout from "../../components/layout/PageLayout";

// --- Types ---
type MessageRole = "user" | "assistant" | "confirm" | "running" | "done" | "error" | "cancelled";

interface Message {
  role: MessageRole;
  content: any;
  [key: string]: any;
}

interface ContentBlock {
  type?: string;
  id?: string | number;
  name?: string;
  input?: any;
  text?: string;
  content?: any;
  [key: string]: any;
}

interface PendingTool {
  id: string | number | null;
  name: string | null;
  input: any;
  assistantContent: ContentBlock[];
  apiMsgsSnapshot: Array<{ role: string; content: any }>;
}

interface ToolResult {
  success: boolean;
  message?: string;
  data?: any;
}

interface ClaudeResponse {
  stop_reason?: string;
  stopReason?: string;
  content?: ContentBlock[] | string;
  [key: string]: any;
}


// ============================================================
// Supabase 연동 실제 사용시 아래 주석 해제
// import { createClient } from "@supabase/supabase-js";
// const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ============================================================

// Claude Tool Use - 사용 가능한 권한 관리 함수 정의
const TOOLS = [
  {
    name: "grant_menu_permission",
    description: "특정 사용자에게 메뉴 접근 권한을 부여합니다.",
    input_schema: {
      type: "object",
      properties: {
        user_name: { type: "string", description: "사용자 이름 (예: 홍길동)" },
        menu_name: { type: "string", description: "메뉴 이름 (예: 메뉴관리, Role관리)" },
        role:      { type: "string", description: "권한 레벨 (admin | write | read)" },
      },
      required: ["user_name", "menu_name", "role"],
    },
  },
  {
    name: "revoke_menu_permission",
    description: "특정 사용자의 메뉴 접근 권한을 제거합니다.",
    input_schema: {
      type: "object",
      properties: {
        user_name: { type: "string", description: "사용자 이름" },
        menu_name: { type: "string", description: "메뉴 이름" },
      },
      required: ["user_name", "menu_name"],
    },
  },
  {
    name: "get_user_permissions",
    description: "특정 사용자의 현재 권한 목록을 조회합니다.",
    input_schema: {
      type: "object",
      properties: {
        user_name: { type: "string", description: "사용자 이름" },
      },
      required: ["user_name"],
    },
  },
];

// ============================================================
// Supabase 실제 연동 함수 (현재는 Mock)
// ============================================================
async function executeToolCall(toolName: string, toolInput: any): Promise<ToolResult> {
  // 실제 연동시 아래처럼 Supabase 쿼리로 교체하세요
  // ex) await supabase.from("user_roles").insert({ ... })

  await new Promise((r) => setTimeout(r, 600)); // 실제처럼 딜레이

  if (toolName === "grant_menu_permission") {
    const { user_name, menu_name, role } = toolInput;
    // 실제: await supabase.from("user_roles").upsert({ user_name, menu_name, role })
    return { success: true, message: `${user_name}님께 [${menu_name}] ${role} 권한이 부여됐습니다.` };
  }

  if (toolName === "revoke_menu_permission") {
    const { user_name, menu_name } = toolInput;
    // 실제: await supabase.from("user_roles").delete().match({ user_name, menu_name })
    return { success: true, message: `${user_name}님의 [${menu_name}] 권한이 제거됐습니다.` };
  }

  if (toolName === "get_user_permissions") {
    const { user_name } = toolInput;
    // 실제: const { data } = await supabase.from("user_roles").select("*").eq("user_name", user_name)
    return {
      success: true,
      data: [
        { menu_name: "메뉴관리", role: "read" },
        { menu_name: "Role관리", role: "write" },
      ],
      message: `${user_name}님의 권한 목록입니다.`,
    };
  }

  return { success: false, message: "알 수 없는 명령입니다." };
}

// ============================================================
// Claude API 호출 (Tool Use 포함)
// ============================================================
async function callClaude(messages: any[]): Promise<ClaudeResponse> {
  // 기본 요청 바디
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: `당신은 포털 서비스의 권한 관리 AI 어시스턴트입니다.
관리자의 자연어 명령을 분석하여 적절한 권한 관리 도구를 호출하세요.
항상 한국어로 응답하고, 실행 전에 무엇을 할지 명확히 설명하세요.
도구 호출 결과를 받으면 사용자 친화적으로 결과를 요약해 주세요.`,
    tools: TOOLS,
    messages,
  };

  try {
    //const res = await fetch("https://api.anthropic.com/v1/messages", {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Claude API error: ${res.status} ${res.statusText} ${text}`);
    }

    const json = await res.json().catch((e) => {
      throw new Error("Failed to parse Claude response JSON: " + String(e));
    });

    // 최소한의 포맷 보장
    if (!json || (json.content === undefined && json.data === undefined)) {
      return { stop_reason: null, content: [] } as unknown as ClaudeResponse;
    }

    return json as ClaudeResponse;
  } catch (err: any) {
    throw new Error(`callClaude failed: ${err?.message || String(err)}`);
  }
}

// ============================================================
// 메인 컴포넌트
// ============================================================
export default function AiPermissionChat() {
  const [messages, setMessages]         = useState<Message[]>([]);       // 화면 메시지
  const [apiMessages, setApiMessages]   = useState<Array<{ role: string; content: any }>>([]); // Claude API용 히스토리
  const [input, setInput]               = useState<string>("");
  const [loading, setLoading]           = useState<boolean>(false);
  const [pendingTool, setPendingTool]   = useState<PendingTool | null>(null);     // 실행 대기 중인 Tool
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // 메시지 추가 헬퍼
  const addMsg = (role: MessageRole, content: any, extra: Record<string, any> = {}) =>
    setMessages((prev) => [...prev, { role, content, ...extra } as Message]);

  // 안전한 Claude 응답 파싱 헬퍼
  const extractContentBlocks = (resp: any): ContentBlock[] => {
    if (!resp) return [];
    if (Array.isArray(resp.content)) return resp.content as ContentBlock[];
    // 경우에 따라 content가 문자열일 수 있음
    if (typeof resp.content === "string") return [{ type: "text", text: resp.content }];
    return [];
  };

  const getStopReason = (resp: any): string | null => {
    if (!resp) return null;
    return (resp.stop_reason as string) ?? (resp.stopReason as string) ?? null;
  };

  // ── 메인 전송 핸들러 ──────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setLoading(true);

    addMsg("user", userText);

    const newApiMsgs = [...apiMessages, { role: "user", content: userText }];
    setApiMessages(newApiMsgs);

    try {
      const data = await callClaude(newApiMsgs);
      const content = extractContentBlocks(data);
      const stopReason = getStopReason(data);

      // 툴 호출로 보이는 경우 (stopReason 또는 content 내 블록 검사)
      const toolUseBlock = content.find((b): b is ContentBlock & { id: string | number; name: string; input: any } => b && b.type === "tool_use" && "id" in b && "name" in b && "input" in b);
      const textBlock = content.find((b) => b && (b.type === "text" || b.text));

      if (stopReason === "tool_use" || toolUseBlock) {
        if (textBlock) addMsg("assistant", textBlock.text || textBlock);

        if (toolUseBlock) {
          setPendingTool({
            id: toolUseBlock.id ?? null,
            name: toolUseBlock.name ?? null,
            input: toolUseBlock.input ?? {},
            assistantContent: content,
            apiMsgsSnapshot: newApiMsgs,
          });

          addMsg("confirm", buildConfirmText(toolUseBlock.name ?? "", toolUseBlock.input));
        } else {
          addMsg("error", "AI가 툴 호출을 제안했으나 세부정보가 없습니다.");
        }
      } else {
        // 일반 텍스트 응답
        const text = content.map((b) => (b && (b.text || b.content)) || "").join("\n");
        addMsg("assistant", text || "(응답이 비어있음)");
        setApiMessages([...newApiMsgs, { role: "assistant", content }]);
      }
    } catch (e) {
      addMsg("error", "API 호출 중 오류가 발생했습니다: " + ((e as any)?.message || String(e)));
    }

    setLoading(false);
  };

  // ── 확인 클릭 → 실제 Tool 실행 ───────────────────────────
  const handleConfirm = async () => {
    const tool = pendingTool;
    if (!tool) return;
    setLoading(true);
    setPendingTool(null);

    // 확인 메시지 → 실행 중으로 교체
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === "confirm");
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      const next = [...prev];
      next[realIdx] = { role: "running", content: "실행 중..." };
      return next;
    });

    try {
      // Supabase 실제 실행
      const result = await executeToolCall(tool.name ?? "", tool.input);

      // Claude에게 tool_result 전달 → 최종 응답
      const msgsWithToolResult = [
        ...tool.apiMsgsSnapshot,
        { role: "assistant", content: tool.assistantContent },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: tool.id,
              content: JSON.stringify(result),
            },
          ],
        },
      ];

      const finalData = await callClaude(msgsWithToolResult);
      const finalContent = extractContentBlocks(finalData);
      const finalText = finalContent.map((b) => (b && (b.text || b.content)) || "").join("\n");

      // 실행 중 → 완료로 교체
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => m.role === "running");
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const next = [...prev];
        next[realIdx] = { role: "done", content: result.message };
        return next;
      });

      addMsg("assistant", finalText || result?.message || "(결과가 비어있음)");
      setApiMessages([
        ...msgsWithToolResult,
        { role: "assistant", content: finalContent },
      ]);
    } catch (e) {
      addMsg("error", "실행 중 오류: " + ((e as any)?.message || String(e)));
    }

    setLoading(false);
  };

  // ── 취소 클릭 ─────────────────────────────────────────────
  const handleCancel = () => {
    setPendingTool(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "confirm" ? { ...m, role: "cancelled", content: "취소됐습니다." } : m
      )
    );
    addMsg("assistant", "명령을 취소했습니다. 다른 명령을 입력해 주세요.");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <PageLayout showLNB={true} parentMenuUrl="/admin/manageqa">
      <div className="ai-permission-wrap">
      {/* 헤더 */}
      <div className="ai-permission-header">
        <span className="ai-permission-dot" />
        <span className="ai-permission-header-title">AI 권한 관리</span>
        <span className="ai-permission-header-sub">자연어로 사용자 권한을 관리하세요</span>
      </div>

      {/* 예시 힌트 */}
      {messages.length === 0 && (
        <div className="ai-permission-hints">
          {[
            "홍길동에게 메뉴관리 admin 권한 줘",
            "김철수의 Role관리 권한 제거해줘",
            "이영희 현재 권한 목록 알려줘",
          ].map((t) => (
            <button key={t} className="ai-permission-hint" onClick={() => setInput(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="msgList">
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            msg={m}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            hasPending={!!pendingTool}
          />
        ))}
        {loading && (
          <div className={"bubble bubble-ai"}>
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="inputRow">
        <textarea
          className="textarea"
          placeholder="예) 홍길동에게 메뉴관리 권한 줘"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading || !!pendingTool}
        />
        <button
          className="sendBtn"
          style={{ opacity: loading || !!pendingTool ? 0.4 : 1 }}
          onClick={handleSend}
          disabled={loading || !!pendingTool}
        >
          전송
        </button>
      </div>
      </div>
    </PageLayout>
  );
}

// ── 메시지 버블 컴포넌트 ──────────────────────────────────
interface MessageBubbleProps {
  msg: Message;
  onConfirm: () => void;
  onCancel: () => void;
  hasPending: boolean;
}

function MessageBubble({ msg, onConfirm, onCancel, hasPending }: MessageBubbleProps) {
  const isUser = msg.role === "user";

  if (msg.role === "confirm") {
    return (
      <div className="confirmBox">
        <div className="confirmText">{msg.content}</div>
        <div className="confirmBtns">
          <button className="btnConfirm" onClick={onConfirm} disabled={!hasPending}>
            ✓ 실행
          </button>
          <button className="btnCancel" onClick={onCancel} disabled={!hasPending}>
            ✕ 취소
          </button>
        </div>
      </div>
    );
  }

  if (msg.role === "done") {
    return (
      <div className="doneBox">
        <span style={{ marginRight: 6 }}>✓</span>{msg.content}
      </div>
    );
  }

  if (msg.role === "cancelled") {
    return <div className="cancelledBox">{msg.content}</div>;
  }

  if (msg.role === "error") {
    return <div className="errorBox">{msg.content}</div>;
  }

  return (
    <div className={"msg-row " + (isUser ? 'user' : 'ai')}>
      <div className={"bubble " + (isUser ? 'bubble-user' : 'bubble-ai')}>
        {msg.content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="dot2" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  );
}

// ── 확인 텍스트 생성 ──────────────────────────────────────
function buildConfirmText(toolName: string, input: any): string {
  if (toolName === "grant_menu_permission")
    return `[${input.user_name}]님께 [${input.menu_name}] 메뉴의 ${input.role} 권한을 부여할까요?`;
  if (toolName === "revoke_menu_permission")
    return `[${input.user_name}]님의 [${input.menu_name}] 권한을 제거할까요?`;
  if (toolName === "get_user_permissions")
    return `[${input.user_name}]님의 권한 목록을 조회할까요?`;
  return "명령을 실행할까요?";
}

// 스타일은 Aipermissionchat.css로 분리되었습니다.