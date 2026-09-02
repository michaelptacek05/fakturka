import { afterEach, describe, expect, it, vi } from "vitest";

import { Priority, ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import {
  compareTasksForBoard,
  isPriority,
  isProjectStatus,
  isTaskOverdue,
  isTaskStatus,
  OPEN_PROJECT_STATUSES,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  PRIORITY_WEIGHT,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
  TASK_BOARD_COLUMNS,
  TASK_STATUS_LABELS,
} from "@/lib/project-task";

afterEach(() => {
  vi.useRealTimers();
});

describe("úplnost číselníků", () => {
  it("každý stav úkolu má sloupec i popisek", () => {
    const statuses = Object.values(TaskStatus);

    expect(TASK_BOARD_COLUMNS).toHaveLength(statuses.length);
    expect([...TASK_BOARD_COLUMNS].sort()).toEqual([...statuses].sort());

    for (const status of statuses) {
      expect(TASK_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("každý stav projektu a priorita mají popisek a pořadí", () => {
    for (const status of Object.values(ProjectStatus)) {
      expect(PROJECT_STATUS_LABELS[status]).toBeTruthy();
      expect(PROJECT_STATUS_ORDER).toContain(status);
    }

    for (const priority of Object.values(Priority)) {
      expect(PRIORITY_LABELS[priority]).toBeTruthy();
      expect(PRIORITY_ORDER).toContain(priority);
    }
  });

  it("otevřené projekty nezahrnují dokončené ani zrušené", () => {
    expect(OPEN_PROJECT_STATUSES).not.toContain(ProjectStatus.DONE);
    expect(OPEN_PROJECT_STATUSES).not.toContain(ProjectStatus.CANCELLED);
  });

  it("urgentní priorita váží nejvíc", () => {
    expect(PRIORITY_WEIGHT[Priority.URGENT]).toBeGreaterThan(
      PRIORITY_WEIGHT[Priority.HIGH],
    );
    expect(PRIORITY_WEIGHT[Priority.HIGH]).toBeGreaterThan(
      PRIORITY_WEIGHT[Priority.MEDIUM],
    );
    expect(PRIORITY_WEIGHT[Priority.MEDIUM]).toBeGreaterThan(
      PRIORITY_WEIGHT[Priority.LOW],
    );
  });
});

describe("validace hodnot z formulářů", () => {
  it("pozná platné hodnoty", () => {
    expect(isTaskStatus(TaskStatus.IN_PROGRESS)).toBe(true);
    expect(isProjectStatus(ProjectStatus.ON_HOLD)).toBe(true);
    expect(isPriority(Priority.URGENT)).toBe(true);
  });

  it("odmítne cizí a prázdné hodnoty", () => {
    expect(isTaskStatus("HOTOVO")).toBe(false);
    expect(isTaskStatus(null)).toBe(false);
    expect(isProjectStatus("BACKLOG")).toBe(false);
    expect(isPriority(undefined)).toBe(false);
  });
});

describe("isTaskOverdue", () => {
  it("hlásí po termínu jen u nedokončených úkolů", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00"));

    const vcera = new Date("2026-09-09T00:00:00");

    expect(
      isTaskOverdue({ dueDate: vcera, status: TaskStatus.TODO }),
    ).toBe(true);
    expect(
      isTaskOverdue({ dueDate: vcera, status: TaskStatus.DONE }),
    ).toBe(false);
  });

  it("dnešní termín ještě po termínu není", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T23:00:00"));

    expect(
      isTaskOverdue({
        dueDate: new Date("2026-09-10T00:00:00"),
        status: TaskStatus.TODO,
      }),
    ).toBe(false);
  });

  it("úkol bez termínu není nikdy po termínu", () => {
    expect(isTaskOverdue({ dueDate: null, status: TaskStatus.BLOCKED })).toBe(
      false,
    );
  });
});

describe("compareTasksForBoard", () => {
  function task(
    position: number,
    priority: Priority,
    dueDate: Date | null = null,
  ) {
    return { dueDate, position, priority };
  }

  it("řadí primárně podle ručního pořadí", () => {
    const sorted = [
      task(200, Priority.URGENT),
      task(100, Priority.LOW),
    ].sort(compareTasksForBoard);

    expect(sorted[0].position).toBe(100);
  });

  it("při stejném pořadí rozhoduje priorita", () => {
    const sorted = [
      task(0, Priority.LOW),
      task(0, Priority.URGENT),
      task(0, Priority.MEDIUM),
    ].sort(compareTasksForBoard);

    expect(sorted.map((item) => item.priority)).toEqual([
      Priority.URGENT,
      Priority.MEDIUM,
      Priority.LOW,
    ]);
  });

  it("při stejné prioritě jde dřívější termín první", () => {
    const sorted = [
      task(0, Priority.HIGH, new Date("2026-10-01T00:00:00")),
      task(0, Priority.HIGH, new Date("2026-09-01T00:00:00")),
    ].sort(compareTasksForBoard);

    expect(sorted[0].dueDate?.getMonth()).toBe(8);
  });

  it("úkoly bez termínu jdou za ty s termínem", () => {
    const sorted = [
      task(0, Priority.HIGH, null),
      task(0, Priority.HIGH, new Date("2026-09-01T00:00:00")),
    ].sort(compareTasksForBoard);

    expect(sorted[0].dueDate).not.toBeNull();
    expect(sorted[1].dueDate).toBeNull();
  });
});
