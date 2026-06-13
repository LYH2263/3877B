import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Clock, Home, MessageCircle, PenSquare, Search, Settings, Trash2, Trophy, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { fetchHotSearch, fetchSearchSuggestions } from "@/api/discovery";
import { fetchUnreadCount } from "@/api/messages";
import { useAuth } from "@/context/auth-context";
import { useSearchHistory } from "@/hooks/use-search-history";
import { parseApiError } from "@/lib/api-error";
import { subscribeMessageEvent } from "@/lib/message-events";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import type { SearchSuggestion, TrendingTopic } from "@/types/models";

const iconClass = "h-4 w-4";

const TAG_STYLES: Record<string, string> = {
  "沸": "bg-red-500 text-white",
  "热": "bg-orange-400 text-white",
  "新": "bg-brand-500 text-white"
};

export function TopNav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { history, add: addHistory, remove: removeHistory, clear: clearHistory } = useSearchHistory();

  const [keyword, setKeyword] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [hotTopics, setHotTopics] = useState<TrendingTopic[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);

  const isTyping = keyword.trim().length > 0;

  useEffect(() => {
    if (!keyword.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchSearchSuggestions(keyword, 8);
        setSuggestions(data);
      } catch (err) {
        const parsed = parseApiError(err);
        if (parsed.status && parsed.status >= 500) {
          setSuggestions([]);
        }
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!focused || hotTopics.length > 0) return;
    let stale = false;
    fetchHotSearch(15)
      .then((data) => {
        if (!stale) setHotTopics(data);
      })
      .catch(() => {});
    return () => { stale = true; };
  }, [focused, hotTopics.length]);

  const totalItems = useMemo(() => {
    if (isTyping) return suggestions.length;
    return history.length + hotTopics.length;
  }, [isTyping, suggestions.length, history.length, hotTopics.length]);

  const showDropdown = useMemo(() => {
    if (!focused) return false;
    if (isTyping) return suggestions.length > 0;
    return history.length > 0 || hotTopics.length > 0;
  }, [focused, isTyping, suggestions.length, history.length, hotTopics.length]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [keyword, focused]);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const payload = await fetchUnreadCount();
      setUnreadCount(payload.unreadCount);
    } catch (error) {
      const parsed = parseApiError(error);
      if (parsed.status === 401) {
        setUnreadCount(0);
      }
    }
  }, [user]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread, location.pathname]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = subscribeMessageEvent((event) => {
      if (event === "refresh-unread") {
        void refreshUnread();
      }
    });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshUnread();
      }
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshUnread();
      }
    }, 60000);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [user, refreshUnread]);

  const runSearch = useCallback((nextKeyword: string) => {
    const q = nextKeyword.trim();
    if (!q) return;
    addHistory(q);
    setFocused(false);
    setKeyword("");
    navigate(`/search?q=${encodeURIComponent(q)}&type=all`);
  }, [addHistory, navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const el = itemRefs.current[activeIndex];
      if (el) el.click();
    }
  }, [showDropdown, totalItems, activeIndex]);

  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(148,163,184,0.12)]">
      <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-3 px-4 lg:px-6">
        <Link to="/" className="mr-2 flex items-center gap-2 text-slate-900 hover:text-slate-900">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">发</span>
          <span className="hidden text-base font-semibold sm:inline">社交发现</span>
        </Link>

        <div className="relative hidden max-w-xl flex-1 md:block">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              runSearch(keyword);
            }}
          >
            <Input
              ref={inputRef}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                window.setTimeout(() => setFocused(false), 150);
              }}
              onKeyDown={handleKeyDown}
              placeholder="搜索热词、用户、话题"
              aria-label="搜索"
              aria-expanded={showDropdown}
              aria-activedescendant={activeIndex >= 0 ? `search-item-${activeIndex}` : undefined}
              role="combobox"
              className="pl-9"
            />
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          </form>

          {showDropdown ? (
            <div
              ref={dropdownRef}
              role="listbox"
              className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
            >
              {isTyping ? (
                <div className="p-2">
                  {suggestions.map((item, idx) => (
                    <button
                      key={item.id}
                      ref={(el) => { itemRefs.current[idx] = el; }}
                      id={`search-item-${idx}`}
                      role="option"
                      aria-selected={activeIndex === idx}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ${activeIndex === idx ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => runSearch(item.keyword)}
                    >
                      <span className="text-sm text-slate-800">{item.label}</span>
                      <span className="text-xs text-slate-500">{item.subtitle}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-2">
                  {history.length > 0 ? (
                    <div className="mb-2">
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Clock className="h-3 w-3" /> 搜索历史
                        </span>
                        <button
                          type="button"
                          className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-red-500"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => clearHistory()}
                        >
                          <Trash2 className="h-3 w-3" /> 清空
                        </button>
                      </div>
                      {history.map((item, idx) => (
                        <div
                          key={`history-${item}`}
                          className="flex items-center"
                        >
                          <button
                            ref={(el) => { itemRefs.current[idx] = el; }}
                            id={`search-item-${idx}`}
                            role="option"
                            aria-selected={activeIndex === idx}
                            type="button"
                            className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left ${activeIndex === idx ? "bg-slate-100" : "hover:bg-slate-50"}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => runSearch(item)}
                          >
                            <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="truncate text-sm text-slate-800">{item}</span>
                          </button>
                          <button
                            type="button"
                            className="mr-2 shrink-0 rounded p-1 text-slate-300 hover:text-slate-500"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => removeHistory(item)}
                            aria-label={`删除 ${item}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {hotTopics.length > 0 ? (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-medium text-slate-500">热搜榜</div>
                      {hotTopics.map((topic, idx) => {
                        const globalIdx = history.length + idx;
                        return (
                          <button
                            key={`hot-${topic.id}`}
                            ref={(el) => { itemRefs.current[globalIdx] = el; }}
                            id={`search-item-${globalIdx}`}
                            role="option"
                            aria-selected={activeIndex === globalIdx}
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${activeIndex === globalIdx ? "bg-slate-100" : "hover:bg-slate-50"}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => runSearch(topic.keyword)}
                          >
                            <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${topic.rank <= 3 ? "bg-brand-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                              {topic.rank}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">#{topic.keyword}#</span>
                            <Badge className={`shrink-0 text-[10px] ${TAG_STYLES[topic.tag] ?? "bg-slate-200 text-slate-600"}`}>
                              {topic.tag}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <nav className="ml-auto flex items-center gap-1">
          <Button variant={location.pathname === "/" ? "secondary" : "ghost"} size="icon" asChild>
            <Link to="/" aria-label="首页">
              <Home className={iconClass} />
            </Link>
          </Button>
          <Button variant={location.pathname === "/leaderboard" ? "secondary" : "ghost"} size="icon" asChild>
            <Link to="/leaderboard" aria-label="排行榜">
              <Trophy className={iconClass} />
            </Link>
          </Button>
          <Button variant={location.pathname === "/creator-center" ? "secondary" : "ghost"} size="icon" asChild>
            <Link to="/creator-center" aria-label="签到">
              <CalendarCheck className={iconClass} />
            </Link>
          </Button>
          <Button variant={location.pathname.startsWith("/messages") ? "secondary" : "ghost"} size="icon" asChild>
            <Link to="/messages" aria-label="消息" className="relative">
              <MessageCircle className={iconClass} />
              {user && unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button variant={location.pathname.startsWith("/settings") ? "secondary" : "ghost"} size="icon" asChild>
            <Link to="/settings" aria-label="设置">
              <Settings className={iconClass} />
            </Link>
          </Button>

          <Button className="ml-2 hidden sm:inline-flex" onClick={() => navigate("/compose")}>
            <PenSquare className="h-4 w-4" /> 发布
          </Button>

          {user ? (
            <div className="ml-2 flex items-center gap-2">
              <Button variant="ghost" className="h-auto p-0" asChild>
                <Link to={`/u/${user.id}`}>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatarUrl ?? undefined} alt={user.nickname} />
                    <AvatarFallback>{user.nickname.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    退出
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
                    <AlertDialogDescription>退出后将无法执行点赞、评论、发布等操作。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void logout()}>确认退出</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="ml-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
                登录
              </Button>
              <Button size="sm" onClick={() => navigate("/register")}>
                注册
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
