import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListTodo } from "lucide-react";

import { ProjectForm } from "@/components/projects/project-form";
import { TaskBoard, type BoardTask } from "@/components/tasks/task-board";
import { TaskCreateForm } from "@/components/tasks/task-create-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatDateInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  compareTasksForBoard,
  isTaskOverdue,
  PRIORITY_LABELS,
  PRIORITY_VARIANTS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_VARIANTS,
} from "@/lib/project-task";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getProject(id: string) {
  try {
    return await prisma.project.findUnique({
      include: {
        client: { select: { companyName: true, fullName: true, id: true } },
        tasks: {
          include: {
            _count: { select: { notes: true } },
          },
        },
      },
      where: { id },
    });
  } catch {
    return null;
  }
}

async function getClients() {
  try {
    return await prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: { companyName: true, fullName: true, id: true },
    });
  } catch {
    return [];
  }
}

function getErrorMessage(error?: string | string[]) {
  switch (error) {
    case "db":
      return "Změny se nepodařilo uložit, protože databáze není dostupná.";
    case "delete":
      return "Projekt se nepodařilo smazat.";
    case "project":
      return "Vyberte prosím projekt, ke kterému úkol patří.";
    default:
      return getValidationMessage(error);
  }
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const { id } = await params;
  const [project, clients] = await Promise.all([getProject(id), getClients()]);
  const query = await searchParams;

  if (!project) {
    notFound();
  }

  const errorMessage = getErrorMessage(query?.error);
  const clientName =
    project.client?.companyName ?? project.client?.fullName ?? null;

  const boardTasks: BoardTask[] = project.tasks
    .slice()
    .sort(compareTasksForBoard)
    .map((task) => ({
      clientName,
      dueDateLabel: task.dueDate ? formatDate(task.dueDate) : null,
      id: task.id,
      isOverdue: isTaskOverdue(task),
      noteCount: task._count.notes,
      priority: task.priority,
      projectId: project.id,
      projectName: project.name,
      status: task.status,
      title: task.title,
    }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={project.name}
        description={
          clientName ? (
            <>
              Odběratel{" "}
              <Link
                href={`/clients/${project.client?.id}`}
                className="underline underline-offset-4"
              >
                {clientName}
              </Link>
            </>
          ) : (
            "Interní projekt bez odběratele."
          )
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/projects">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Zpět na projekty
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={PROJECT_STATUS_VARIANTS[project.status]}>
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
        <Badge variant={PRIORITY_VARIANTS[project.priority]}>
          {PRIORITY_LABELS[project.priority]}
        </Badge>
        {project.startDate ? (
          <span className="text-xs text-muted-foreground">
            Začátek {formatDate(project.startDate)}
          </span>
        ) : null}
        {project.dueDate ? (
          <span className="text-xs text-muted-foreground">
            Termín {formatDate(project.dueDate)}
          </span>
        ) : null}
      </div>

      {query?.saved === "1" ? (
        <Alert variant="success" title="Projekt byl uložen." />
      ) : null}

      {query?.taskCreated === "1" ? (
        <Alert variant="success" title="Úkol byl přidán." />
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive" title={errorMessage} />
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListTodo className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold tracking-tight">
              Úkoly projektu
            </h2>
            <span className="text-sm text-muted-foreground">
              {project.tasks.length}
            </span>
          </div>

          <TaskCreateForm
            fixedProjectId={project.id}
            projects={[]}
            returnTo={`/projects/${project.id}`}
          />
        </div>

        <TaskBoard tasks={boardTasks} showProject={false} />
      </section>

      <ProjectForm
        clients={clients.map((client) => ({
          id: client.id,
          name: client.companyName ?? client.fullName ?? "Bez názvu",
        }))}
        projectId={project.id}
        taskCount={project.tasks.length}
        defaultValues={{
          clientId: project.clientId ?? "",
          description: project.description ?? "",
          dueDate: project.dueDate ? formatDateInput(project.dueDate) : "",
          name: project.name,
          priority: project.priority,
          startDate: project.startDate ? formatDateInput(project.startDate) : "",
          status: project.status,
        }}
      />
    </div>
  );
}
