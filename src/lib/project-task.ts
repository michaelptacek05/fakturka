import { Priority, ProjectStatus, TaskStatus } from "@/generated/prisma/enums";

export type BadgeVariant =
  | "default"
  | "outline"
  | "primary"
  | "success"
  | "warning"
  | "destructive";

/** Sloupce nástěnky zleva doprava. */
export const TASK_BOARD_COLUMNS: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
  TaskStatus.DONE,
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "Zásobník",
  [TaskStatus.BLOCKED]: "Blokováno",
  [TaskStatus.DONE]: "Hotovo",
  [TaskStatus.IN_PROGRESS]: "Dělá se",
  [TaskStatus.TODO]: "K udělání",
};

export const TASK_STATUS_VARIANTS: Record<TaskStatus, BadgeVariant> = {
  [TaskStatus.BACKLOG]: "outline",
  [TaskStatus.BLOCKED]: "destructive",
  [TaskStatus.DONE]: "success",
  [TaskStatus.IN_PROGRESS]: "primary",
  [TaskStatus.TODO]: "default",
};

/** Barva pruhu nad sloupcem nástěnky. */
export const TASK_STATUS_ACCENTS: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "bg-muted-foreground/40",
  [TaskStatus.BLOCKED]: "bg-destructive",
  [TaskStatus.DONE]: "bg-success",
  [TaskStatus.IN_PROGRESS]: "bg-primary",
  [TaskStatus.TODO]: "bg-chart-2",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.ACTIVE]: "Běží",
  [ProjectStatus.CANCELLED]: "Zrušeno",
  [ProjectStatus.DONE]: "Dokončeno",
  [ProjectStatus.ON_HOLD]: "Pozastaveno",
  [ProjectStatus.PLANNED]: "Plánováno",
};

export const PROJECT_STATUS_VARIANTS: Record<ProjectStatus, BadgeVariant> = {
  [ProjectStatus.ACTIVE]: "primary",
  [ProjectStatus.CANCELLED]: "outline",
  [ProjectStatus.DONE]: "success",
  [ProjectStatus.ON_HOLD]: "warning",
  [ProjectStatus.PLANNED]: "default",
};

/** Projekty, které se počítají jako živé — kvůli přehledům a řazení. */
export const OPEN_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNED,
  ProjectStatus.ACTIVE,
  ProjectStatus.ON_HOLD,
];

export const PRIORITY_LABELS: Record<Priority, string> = {
  [Priority.HIGH]: "Vysoká",
  [Priority.LOW]: "Nízká",
  [Priority.MEDIUM]: "Střední",
  [Priority.URGENT]: "Urgentní",
};

export const PRIORITY_VARIANTS: Record<Priority, BadgeVariant> = {
  [Priority.HIGH]: "warning",
  [Priority.LOW]: "outline",
  [Priority.MEDIUM]: "default",
  [Priority.URGENT]: "destructive",
};

/** Vyšší číslo = naléhavější. Používá se pro řazení. */
export const PRIORITY_WEIGHT: Record<Priority, number> = {
  [Priority.HIGH]: 3,
  [Priority.LOW]: 1,
  [Priority.MEDIUM]: 2,
  [Priority.URGENT]: 4,
};

export const PRIORITY_ORDER: Priority[] = [
  Priority.URGENT,
  Priority.HIGH,
  Priority.MEDIUM,
  Priority.LOW,
];

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  ProjectStatus.ACTIVE,
  ProjectStatus.PLANNED,
  ProjectStatus.ON_HOLD,
  ProjectStatus.DONE,
  ProjectStatus.CANCELLED,
];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    (TASK_BOARD_COLUMNS as string[]).includes(value)
  );
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" &&
    (PROJECT_STATUS_ORDER as string[]).includes(value)
  );
}

export function isPriority(value: unknown): value is Priority {
  return (
    typeof value === "string" && (PRIORITY_ORDER as string[]).includes(value)
  );
}

/**
 * Úkol je po termínu, jen když ještě není hotový. Hotové úkoly už
 * termín nezajímá, jinak by nástěnka svítila červeně napořád.
 */
export function isTaskOverdue(task: {
  dueDate: Date | null;
  status: TaskStatus;
}) {
  if (!task.dueDate || task.status === TaskStatus.DONE) {
    return false;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return task.dueDate < todayStart;
}

/**
 * Řazení uvnitř sloupce: ruční pořadí, pak priorita, pak termín.
 * Používá ho nástěnka i výpočet nového `position` při přesunu.
 */
export function compareTasksForBoard(
  a: { dueDate: Date | null; position: number; priority: Priority },
  b: { dueDate: Date | null; position: number; priority: Priority },
) {
  if (a.position !== b.position) {
    return a.position - b.position;
  }

  const weightDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];

  if (weightDiff !== 0) {
    return weightDiff;
  }

  if (a.dueDate && b.dueDate) {
    return a.dueDate.getTime() - b.dueDate.getTime();
  }

  if (a.dueDate) {
    return -1;
  }

  if (b.dueDate) {
    return 1;
  }

  return 0;
}
