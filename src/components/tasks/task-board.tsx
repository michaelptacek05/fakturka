"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, GripVertical, MessageSquare } from "lucide-react";

import { moveTask } from "@/app/(app)/projects/actions";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";
import {
  PRIORITY_LABELS,
  PRIORITY_VARIANTS,
  TASK_BOARD_COLUMNS,
  TASK_STATUS_ACCENTS,
  TASK_STATUS_LABELS,
} from "@/lib/project-task";
import { cn } from "@/lib/utils";

export type BoardTask = {
  clientName: string | null;
  dueDateLabel: string | null;
  id: string;
  isOverdue: boolean;
  noteCount: number;
  priority: Priority;
  projectId: string;
  projectName: string;
  status: TaskStatus;
  title: string;
};

type TaskBoardProps = {
  /** Na detailu projektu je název projektu na kartě zbytečný. */
  showProject?: boolean;
  tasks: BoardTask[];
};

type DropTarget = {
  beforeTaskId: string | null;
  status: TaskStatus;
};

type TaskMove = DropTarget & { taskId: string };

/**
 * Přepočet pořadí pro okamžitou odezvu při přetažení. Server pak pošle
 * skutečný stav a optimistická úprava se zahodí.
 */
function reorderTasks(tasks: BoardTask[], move: TaskMove): BoardTask[] {
  const moved = tasks.find((task) => task.id === move.taskId);

  if (!moved) {
    return tasks;
  }

  const rest = tasks.filter((task) => task.id !== move.taskId);
  const insertIndex = move.beforeTaskId
    ? rest.findIndex((task) => task.id === move.beforeTaskId)
    : -1;
  const updated = { ...moved, status: move.status };

  return insertIndex === -1
    ? [...rest, updated]
    : [
        ...rest.slice(0, insertIndex),
        updated,
        ...rest.slice(insertIndex),
      ];
}

export function TaskBoard({ showProject = true, tasks }: TaskBoardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, applyOptimisticMove] = useOptimistic(tasks, reorderTasks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  function applyMove(taskId: string, target: DropTarget) {
    startTransition(async () => {
      applyOptimisticMove({ ...target, taskId });

      await moveTask(taskId, target.status, target.beforeTaskId);
      router.refresh();
    });
  }

  function handleDrop(event: React.DragEvent, target: DropTarget) {
    event.preventDefault();

    const taskId = event.dataTransfer.getData("text/plain") || draggedId;

    setDraggedId(null);
    setDropTarget(null);

    if (!taskId || taskId === target.beforeTaskId) {
      return;
    }

    applyMove(taskId, target);
  }

  function changeStatus(taskId: string, status: TaskStatus) {
    applyMove(taskId, { beforeTaskId: null, status });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {TASK_BOARD_COLUMNS.map((status) => {
        const columnTasks = items.filter((task) => task.status === status);
        const isColumnTarget =
          dropTarget?.status === status && dropTarget.beforeTaskId === null;

        return (
          <section
            key={status}
            aria-label={TASK_STATUS_LABELS[status]}
            className={cn(
              "flex min-h-40 flex-col rounded-xl border border-border bg-muted/40 transition-colors",
              isColumnTarget && "border-primary/60 bg-primary/5",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget({ beforeTaskId: null, status });
            }}
            onDragLeave={(event) => {
              // Ignorujeme přechody mezi vnořenými prvky uvnitř sloupce.
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDropTarget(null);
              }
            }}
            onDrop={(event) => handleDrop(event, { beforeTaskId: null, status })}
          >
            <header className="flex items-center gap-2 px-3 pt-3">
              <span
                className={cn("size-2 rounded-full", TASK_STATUS_ACCENTS[status])}
                aria-hidden="true"
              />
              <h3 className="text-sm font-medium">
                {TASK_STATUS_LABELS[status]}
              </h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {columnTasks.length}
              </span>
            </header>

            <div className="flex flex-1 flex-col gap-2 p-3">
              {columnTasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Přetáhněte sem úkol
                </p>
              ) : null}

              {columnTasks.map((task) => {
                const isCardTarget =
                  dropTarget?.status === status &&
                  dropTarget.beforeTaskId === task.id;

                return (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedId(task.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDropTarget(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDropTarget({ beforeTaskId: task.id, status });
                    }}
                    onDrop={(event) => {
                      event.stopPropagation();
                      handleDrop(event, { beforeTaskId: task.id, status });
                    }}
                    className={cn(
                      "group rounded-lg border border-border bg-card p-3 transition-all",
                      draggedId === task.id && "opacity-40",
                      isCardTarget && "ring-2 ring-primary/60",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical
                        className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground/60"
                        aria-hidden="true"
                      />
                      <Link
                        href={`/tasks/${task.id}`}
                        className="min-w-0 flex-1 text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                      >
                        {task.title}
                      </Link>
                    </div>

                    {showProject ? (
                      <p className="mt-1.5 truncate pl-6 text-xs text-muted-foreground">
                        {task.projectName}
                        {task.clientName ? ` · ${task.clientName}` : ""}
                      </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                      <Badge variant={PRIORITY_VARIANTS[task.priority]}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>

                      {task.dueDateLabel ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs",
                            task.isOverdue
                              ? "font-medium text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          <CalendarDays className="size-3" aria-hidden="true" />
                          {task.dueDateLabel}
                        </span>
                      ) : null}

                      {task.noteCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="size-3" aria-hidden="true" />
                          {task.noteCount}
                        </span>
                      ) : null}
                    </div>

                    {/* Na dotykových displejích se netáhne, tam se stav mění výběrem. */}
                    <Select
                      className="mt-2 h-8 text-xs xl:hidden"
                      aria-label={`Stav úkolu ${task.title}`}
                      value={task.status}
                      onChange={(event) =>
                        changeStatus(task.id, event.target.value as TaskStatus)
                      }
                    >
                      {TASK_BOARD_COLUMNS.map((option) => (
                        <option key={option} value={option}>
                          {TASK_STATUS_LABELS[option]}
                        </option>
                      ))}
                    </Select>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
