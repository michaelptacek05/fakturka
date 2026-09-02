import Link from "next/link";
import { FolderKanban, FolderPlus } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TaskStatus } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  PRIORITY_LABELS,
  PRIORITY_VARIANTS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
  PROJECT_STATUS_VARIANTS,
} from "@/lib/project-task";

export const dynamic = "force-dynamic";

async function getProjects() {
  try {
    return await prisma.project.findMany({
      include: {
        client: {
          select: { companyName: true, fullName: true, id: true },
        },
        tasks: {
          select: { status: true },
        },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
  } catch {
    return null;
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const projects = await getProjects();

  // Projekty seskupíme podle odběratele, interní dáme na konec.
  const groups = new Map<
    string,
    { clientId: string | null; name: string; projects: NonNullable<typeof projects> }
  >();

  for (const project of projects ?? []) {
    const clientName =
      project.client?.companyName ?? project.client?.fullName ?? null;
    const key = project.clientId ?? "__interni__";

    if (!groups.has(key)) {
      groups.set(key, {
        clientId: project.clientId,
        name: clientName ?? "Interní projekty",
        projects: [],
      });
    }

    groups.get(key)!.projects.push(project);
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (!a.clientId) {
      return 1;
    }

    if (!b.clientId) {
      return -1;
    }

    return a.name.localeCompare(b.name, "cs");
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Projekty"
        description="Zakázky rozdělené podle odběratelů. Úkoly se zadávají pod projekt."
        actions={
          <Button asChild>
            <Link href="/projects/new">
              <FolderPlus className="size-4" aria-hidden="true" />
              Nový projekt
            </Link>
          </Button>
        }
      />

      {params?.deleted === "1" ? (
        <Alert variant="success" title="Projekt byl smazán." />
      ) : null}

      {projects === null ? (
        <Alert variant="destructive" title="Databáze není dostupná">
          Spusťte PostgreSQL a migrace, potom stránku obnovte.
        </Alert>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="Zatím žádné projekty"
            description="Založte projekt pod odběratelem a začněte si k němu psát úkoly."
            action={
              <Button asChild>
                <Link href="/projects/new">Založit první projekt</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedGroups.map((group) => (
            <section
              key={group.clientId ?? "interni"}
              className="space-y-3"
              aria-label={group.name}
            >
              <div className="flex items-baseline gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.clientId ? (
                    <Link
                      href={`/clients/${group.clientId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {group.name}
                    </Link>
                  ) : (
                    group.name
                  )}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {group.projects.length}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.projects
                  .slice()
                  .sort(
                    (a, b) =>
                      PROJECT_STATUS_ORDER.indexOf(a.status) -
                      PROJECT_STATUS_ORDER.indexOf(b.status),
                  )
                  .map((project) => {
                    const openTasks = project.tasks.filter(
                      (task) => task.status !== TaskStatus.DONE,
                    ).length;

                    return (
                      <Card key={project.id} className="flex flex-col">
                        <CardHeader className="gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <CardTitle>
                              <Link
                                href={`/projects/${project.id}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {project.name}
                              </Link>
                            </CardTitle>
                            <Badge
                              variant={PROJECT_STATUS_VARIANTS[project.status]}
                            >
                              {PROJECT_STATUS_LABELS[project.status]}
                            </Badge>
                          </div>
                          {project.description ? (
                            <CardDescription className="line-clamp-2">
                              {project.description}
                            </CardDescription>
                          ) : null}
                        </CardHeader>

                        <CardContent className="mt-auto space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={PRIORITY_VARIANTS[project.priority]}
                            >
                              {PRIORITY_LABELS[project.priority]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {project.tasks.length === 0
                                ? "Bez úkolů"
                                : `${openTasks} z ${project.tasks.length} otevřených`}
                            </span>
                          </div>

                          {project.dueDate ? (
                            <p className="text-xs text-muted-foreground">
                              Termín {formatDate(project.dueDate)}
                            </p>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
