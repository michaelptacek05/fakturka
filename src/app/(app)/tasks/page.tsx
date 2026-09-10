import Link from "next/link";
import { Search } from "lucide-react";

import { TaskBoard, type BoardTask } from "@/components/tasks/task-board";
import { TaskCreateForm } from "@/components/tasks/task-create-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { TaskStatus } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  compareTasksForBoard,
  isPriority,
  isTaskOverdue,
  OPEN_PROJECT_STATUSES,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
} from "@/lib/project-task";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function getProjects() {
  try {
    return await prisma.project.findMany({
      include: {
        client: { select: { companyName: true, fullName: true } },
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return null;
  }
}

async function getTasks(filters: { priority?: string; projectId?: string }) {
  try {
    return await prisma.task.findMany({
      include: {
        _count: { select: { notes: true } },
        project: {
          include: {
            client: { select: { companyName: true, fullName: true } },
          },
        },
      },
      where: {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(isPriority(filters.priority) ? { priority: filters.priority } : {}),
      },
    });
  } catch {
    return null;
  }
}

function getErrorMessage(error?: string | string[]) {
  switch (error) {
    case "db":
      return "Akci se nepodařilo dokončit, protože databáze není dostupná.";
    case "project":
      return "Vyberte prosím projekt, ke kterému úkol patří.";
    case "notfound":
      return "Úkol nebyl nalezen.";
    default:
      return getValidationMessage(error);
  }
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const projectFilter =
    typeof params?.project === "string" ? params.project : "";
  const priorityFilter =
    typeof params?.priority === "string" ? params.priority : "";

  const [projects, tasks] = await Promise.all([
    getProjects(),
    getTasks({ priority: priorityFilter, projectId: projectFilter || undefined }),
  ]);

  const errorMessage = getErrorMessage(params?.error);
  const hasFilters = Boolean(projectFilter || priorityFilter);

  const projectOptions = (projects ?? []).map((project) => ({
    clientName: project.client?.companyName ?? project.client?.fullName ?? null,
    id: project.id,
    name: project.name,
  }));

  // Do rychlého přidání nabízíme jen projekty, které se ještě řeší.
  const openProjectOptions = (projects ?? [])
    .filter((project) => OPEN_PROJECT_STATUSES.includes(project.status))
    .map((project) => ({
      clientName:
        project.client?.companyName ?? project.client?.fullName ?? null,
      id: project.id,
      name: project.name,
    }));

  const boardTasks: BoardTask[] = (tasks ?? [])
    .slice()
    .sort(compareTasksForBoard)
    .map((task) => ({
      clientName:
        task.project.client?.companyName ??
        task.project.client?.fullName ??
        null,
      dueDateLabel: task.dueDate ? formatDate(task.dueDate) : null,
      id: task.id,
      isOverdue: isTaskOverdue(task),
      noteCount: task._count.notes,
      priority: task.priority,
      projectId: task.projectId,
      projectName: task.project.name,
      status: task.status,
      title: task.title,
    }));

  const openCount = boardTasks.filter(
    (task) => task.status !== TaskStatus.DONE,
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Úkoly"
        description={
          projects === null
            ? undefined
            : `${openCount} otevřených úkolů. Stav změníte přetažením karty mezi sloupci.`
        }
        actions={
          <TaskCreateForm
            projects={openProjectOptions}
            returnTo="/tasks"
          />
        }
      />

      {projects === null || tasks === null ? (
        <Alert variant="destructive" title="Databáze není dostupná">
          Spusťte PostgreSQL a migrace, potom stránku obnovte.
        </Alert>
      ) : null}

      {params?.taskCreated === "1" ? (
        <Alert variant="success" title="Úkol byl přidán." />
      ) : null}

      {params?.taskDeleted === "1" ? (
        <Alert variant="success" title="Úkol byl smazán." />
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive" title={errorMessage} />
      ) : null}

      {projects !== null && projects.length === 0 ? (
        <Card>
          <EmptyState
            title="Nejdřív potřebujete projekt"
            description="Úkoly se zadávají pod projekt. Založte první projekt a vraťte se sem."
            action={
              <Button asChild>
                <Link href="/projects/new">Založit projekt</Link>
              </Button>
            }
          />
        </Card>
      ) : null}

      {projects !== null && projects.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4">
              <form
                className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                method="get"
              >
                <SelectField
                  className="sm:w-72"
                  label="Projekt"
                  name="project"
                  defaultValue={projectFilter}
                >
                  <option value="">Všechny projekty</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                      {project.clientName ? ` — ${project.clientName}` : ""}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  className="sm:w-52"
                  label="Priorita"
                  name="priority"
                  defaultValue={priorityFilter}
                >
                  <option value="">Všechny priority</option>
                  {PRIORITY_ORDER.map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </SelectField>

                <div className="flex gap-2">
                  <Button type="submit" variant="outline">
                    <Search className="size-4" aria-hidden="true" />
                    Filtrovat
                  </Button>
                  {hasFilters ? (
                    <Button asChild variant="ghost">
                      <Link href="/tasks">Zrušit filtry</Link>
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          {boardTasks.length === 0 ? (
            <Card>
              <EmptyState
                title={hasFilters ? "Nic nenalezeno" : "Zatím žádné úkoly"}
                description={
                  hasFilters
                    ? "Zkuste upravit filtry."
                    : "Přidejte první úkol tlačítkem nahoře."
                }
                action={
                  hasFilters ? (
                    <Button asChild variant="outline">
                      <Link href="/tasks">Zrušit filtry</Link>
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            <TaskBoard tasks={boardTasks} />
          )}
        </>
      ) : null}
    </div>
  );
}
