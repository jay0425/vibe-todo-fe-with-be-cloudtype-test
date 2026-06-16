import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Todo = {
	id: string;
	title: string;
	completed: boolean;
	createdAt: string;
	updatedAt: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
	throw new Error("VITE_API_BASE_URL 환경변수가 설정되지 않았습니다.");
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
		...init,
	});

	if (response.status === 204) {
		return undefined as T;
	}

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error ?? "요청을 처리하지 못했습니다.");
	}

	return data;
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("ko-KR", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function App() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [newTitle, setNewTitle] = useState("");
	const [editingTitle, setEditingTitle] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const selectedTodo = useMemo(
		() => todos.find((todo) => todo.id === selectedId) ?? null,
		[selectedId, todos],
	);

	const completedCount = todos.filter((todo) => todo.completed).length;
	const activeCount = todos.length - completedCount;

	useEffect(() => {
		void loadTodos();
	}, []);

	async function loadTodos() {
		try {
			setIsLoading(true);
			setError(null);
			const data = await requestJson<{ todos: Todo[] }>("/todos");
			setTodos(data.todos);
			setSelectedId((currentId) => {
				const currentTodo = data.todos.find((todo) => todo.id === currentId);
				const nextId = currentTodo?.id ?? data.todos[0]?.id ?? null;
				const nextTodo = data.todos.find((todo) => todo.id === nextId);
				setEditingTitle(nextTodo?.title ?? "");
				return nextId;
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다.");
		} finally {
			setIsLoading(false);
		}
	}

	async function createTodo(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const title = newTitle.trim();
		if (!title) {
			setError("할 일을 입력해주세요.");
			return;
		}

		try {
			setIsSaving(true);
			setError(null);
			const data = await requestJson<{ todo: Todo }>("/todos", {
				method: "POST",
				body: JSON.stringify({ title }),
			});
			setTodos((currentTodos) => [data.todo, ...currentTodos]);
			setSelectedId(data.todo.id);
			setEditingTitle(data.todo.title);
			setNewTitle("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "할 일을 추가하지 못했습니다.");
		} finally {
			setIsSaving(false);
		}
	}

	async function updateTodo(id: string, updates: Partial<Pick<Todo, "title" | "completed">>) {
		try {
			setIsSaving(true);
			setError(null);
			const data = await requestJson<{ todo: Todo }>(`/todos/${id}`, {
				method: "PATCH",
				body: JSON.stringify(updates),
			});
			setTodos((currentTodos) => currentTodos.map((todo) => (todo.id === id ? data.todo : todo)));
			if (selectedId === id) {
				setEditingTitle(data.todo.title);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "할 일을 수정하지 못했습니다.");
		} finally {
			setIsSaving(false);
		}
	}

	async function saveSelectedTitle(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!selectedTodo) {
			return;
		}

		const title = editingTitle.trim();
		if (!title) {
			setError("제목은 비워둘 수 없습니다.");
			return;
		}

		await updateTodo(selectedTodo.id, { title });
	}

	async function deleteTodo(id: string) {
		try {
			setIsSaving(true);
			setError(null);
			await requestJson<void>(`/todos/${id}`, { method: "DELETE" });
			setTodos((currentTodos) => {
				const nextTodos = currentTodos.filter((todo) => todo.id !== id);
				setSelectedId((currentId) => {
					if (currentId !== id) {
						return currentId;
					}

					const nextTodo = nextTodos[0] ?? null;
					setEditingTitle(nextTodo?.title ?? "");
					return nextTodo?.id ?? null;
				});
				return nextTodos;
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "할 일을 삭제하지 못했습니다.");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<main className="min-h-screen bg-[#f7f7f2] px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
				<header className="flex flex-col gap-4 border-b border-stone-300 pb-5 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
							Todo CRUD
						</p>
						<h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
							오늘 할 일
						</h1>
					</div>
					<div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
						<Stat label="전체" value={todos.length} />
						<Stat label="진행" value={activeCount} />
						<Stat label="완료" value={completedCount} />
					</div>
				</header>

				<form
					className="flex flex-col gap-3 rounded-lg border border-stone-300 bg-white p-4 shadow-sm sm:flex-row"
					onSubmit={createTodo}>
					<label className="sr-only" htmlFor="newTodo">
						새 할 일
					</label>
					<input
						id="newTodo"
						className="min-h-11 flex-1 rounded-md border border-stone-300 bg-white px-3 text-base outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
						placeholder="새 할 일을 입력하세요"
						value={newTitle}
						onChange={(event) => setNewTitle(event.target.value)}
					/>
					<button
						className="min-h-11 rounded-md bg-teal-700 px-5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
						disabled={isSaving}
						type="submit">
						추가
					</button>
				</form>

				{error ? (
					<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
						{error}
					</div>
				) : null}

				<section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
					<div className="overflow-hidden rounded-lg border border-stone-300 bg-white shadow-sm">
						<div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
							<h2 className="text-base font-bold text-slate-950">목록</h2>
							<button
								className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-stone-100"
								type="button"
								onClick={() => void loadTodos()}>
								새로고침
							</button>
						</div>

						{isLoading ? (
							<div className="p-8 text-center text-slate-500">불러오는 중...</div>
						) : todos.length === 0 ? (
							<div className="p-8 text-center text-slate-500">아직 등록된 할 일이 없습니다.</div>
						) : (
							<ul className="divide-y divide-stone-200">
								{todos.map((todo) => (
									<li key={todo.id}>
										<button
											className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50 ${
												selectedId === todo.id ? "bg-teal-50" : "bg-white"
											}`}
											type="button"
											onClick={() => {
												setSelectedId(todo.id);
												setEditingTitle(todo.title);
											}}>
											<input
												aria-label={`${todo.title} 완료 여부`}
												checked={todo.completed}
												className="size-5 accent-teal-700"
												type="checkbox"
												onChange={(event) => {
													event.stopPropagation();
													void updateTodo(todo.id, { completed: event.target.checked });
												}}
												onClick={(event) => event.stopPropagation()}
											/>
											<span className="min-w-0">
												<span
													className={`block truncate font-semibold ${
														todo.completed ? "text-slate-400 line-through" : "text-slate-900"
													}`}>
													{todo.title}
												</span>
												<span className="mt-1 block text-xs text-slate-500">
													{formatDate(todo.createdAt)}
												</span>
											</span>
											<span
												className={`rounded-full px-2.5 py-1 text-xs font-bold ${
													todo.completed
														? "bg-emerald-100 text-emerald-700"
														: "bg-amber-100 text-amber-700"
												}`}>
												{todo.completed ? "완료" : "진행"}
											</span>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>

					<aside className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
						{selectedTodo ? (
							<div className="flex h-full flex-col gap-5">
								<div>
									<p className="text-sm font-semibold text-teal-700">상세</p>
									<h2 className="mt-1 text-xl font-bold text-slate-950">할 일 수정</h2>
								</div>

								<form className="flex flex-col gap-3" onSubmit={saveSelectedTitle}>
									<label className="text-sm font-semibold text-slate-700" htmlFor="editTodo">
										제목
									</label>
									<input
										id="editTodo"
										className="min-h-11 rounded-md border border-stone-300 px-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
										value={editingTitle}
										onChange={(event) => setEditingTitle(event.target.value)}
									/>
									<button
										className="min-h-11 rounded-md bg-slate-900 px-4 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
										disabled={isSaving}
										type="submit">
										저장
									</button>
								</form>

								<label className="flex items-center justify-between gap-3 rounded-md border border-stone-300 p-3">
									<span>
										<span className="block font-semibold text-slate-900">완료 상태</span>
										<span className="text-sm text-slate-500">
											체크하면 완료된 할 일로 표시됩니다.
										</span>
									</span>
									<input
										checked={selectedTodo.completed}
										className="size-5 accent-teal-700"
										type="checkbox"
										onChange={(event) =>
											void updateTodo(selectedTodo.id, { completed: event.target.checked })
										}
									/>
								</label>

								<div className="rounded-md bg-stone-100 p-3 text-sm text-slate-600">
									<p>생성: {formatDate(selectedTodo.createdAt)}</p>
									<p className="mt-1">수정: {formatDate(selectedTodo.updatedAt)}</p>
								</div>

								<button
									className="mt-auto min-h-11 rounded-md border border-red-200 bg-red-50 px-4 font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
									disabled={isSaving}
									type="button"
									onClick={() => void deleteTodo(selectedTodo.id)}>
									삭제
								</button>
							</div>
						) : (
							<div className="flex min-h-72 items-center justify-center text-center text-slate-500">
								목록에서 할 일을 선택하세요.
							</div>
						)}
					</aside>
				</section>
			</div>
		</main>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border border-stone-300 bg-white px-3 py-2 shadow-sm">
			<div className="text-lg font-bold text-slate-950">{value}</div>
			<div className="text-xs font-semibold text-slate-500">{label}</div>
		</div>
	);
}

export default App;
