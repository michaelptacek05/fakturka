import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquarePlus, Save, Trash2 } from "lucide-react";

import {
  addTaskNote,
  deleteTask,
  deleteTaskNote,
  updateTask,
} from "@/app/(app)/projects/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { InputField, SelectField, TextareaField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatDateInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  isTaskOverdue,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  PRIORITY_VARIANTS,
  TASK_BOARD_COLUMNS,
  TASK_STATUS_LABELS,
  TASK_STATUS_VARIANTS,
} from "@/lib/project-task";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

type TaskDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getTask(id: string) {
  try {
    return await prisma.task.findUnique({
      include: {
        notes: { orderBy: { createdAt: "desc" } },
        project: {
          include: {
            client: { select: { companyName: true, fullName: true, id: true } },
          },
        },
      },
      where: { id },
    });
  } catch {
    return null;
  }
}

function getErrorMessage(error?: string | string[]) {
  switch (error) {
    case "db":
      return "Změny se nepodařilo uložit, protože databáze není dostupná.";
    case "delete":
      return "Úkol se nepodařilo smazat.";
    case "note":
      return "Poznámka nesmí být prázdná.";
    default:
      return getValidationMessage(error);
  }
}

const noteTimeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function TaskDetailPage({
  params,
  searchParams,
}: TaskDetailPageProps) {
  const { id } = await params;
  const task = await getTask(id);
  const query = await searchParams;

  if (!task) {
    notFound();
  }

  const errorMessage = getErrorMessage(query?.error);
  const clientName =
    task.project.client?.companyName ?? task.project.client?.fullName ?? null;
  const overdue = isTaskOverdue(task);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={task.title}
        description={
          <>
            Projekt{" "}
            <Link
              href={`/projects/${task.projectId}`}
              className="underline underline-offset-4"
            >
              {task.project.name}
            </Link>
            {clientName ? ` · ${clientName}` : ""}
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/tasks">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Zpět na úkoly
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={TASK_STATUS_VARIANTS[task.status]}>
          {TASK_STATUS_LABELS[task.status]}
        </Badge>
        <Badge variant={PRIORITY_VARIANTS[task.priority]}>
          {PRIORITY_LABELS[task.priority]}
        </Badge>
        {task.dueDate ? (
          <span
            className={
              overdue
                ? "text-xs font-medium text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            Termín {formatDate(task.dueDate)}
            {overdue ? " — po termínu" : ""}
          </span>
        ) : null}
        {task.doneAt ? (
          <span className="text-xs text-muted-foreground">
            Hotovo {formatDate(task.doneAt)}
          </span>
        ) : null}
      </div>

      {query?.saved === "1" ? (
        <Alert variant="success" title="Úkol byl uložen." />
      ) : null}

      {query?.noteAdded === "1" ? (
        <Alert variant="success" title="Poznámka byla přidána." />
      ) : null}

      {query?.noteDeleted === "1" ? (
        <Alert variant="success" title="Poznámka byla smazána." />
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive" title={errorMessage} />
      ) : null}

      <form action={updateTask.bind(null, task.id)}>
        <Card>
          <CardHeader>
            <CardTitle>Detail úkolu</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                className="md:col-span-2"
                label="Název"
                name="title"
                required
                defaultValue={task.title}
              />

              <SelectField label="Stav" name="status" defaultValue={task.status}>
                {TASK_BOARD_COLUMNS.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Priorita"
                name="priority"
                defaultValue={task.priority}
              >
                {PRIORITY_ORDER.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </SelectField>

              <InputField
                label="Termín"
                name="dueDate"
                type="date"
                defaultValue={task.dueDate ? formatDateInput(task.dueDate) : ""}
              />

              <TextareaField
                className="md:col-span-2"
                label="Popis"
                name="description"
                rows={4}
                placeholder="Co je potřeba udělat…"
                defaultValue={task.description ?? ""}
              />
            </div>
          </CardContent>

          <CardFooter className="justify-end">
            <Button type="submit">
              <Save className="size-4" aria-hidden="true" />
              Uložit úkol
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Poznámky</CardTitle>
          <CardDescription>
            Průběh práce, domluvy a co ještě zbývá. Řadí se od nejnovější.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <form action={addTaskNote.bind(null, task.id)} className="space-y-3">
            <TextareaField
              label="Nová poznámka"
              name="body"
              rows={3}
              required
              placeholder="Např. Domluveno s klientem, že se posune termín o týden."
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                <MessageSquarePlus className="size-4" aria-hidden="true" />
                Přidat poznámku
              </Button>
            </div>
          </form>

          {task.notes.length === 0 ? (
            <EmptyState
              className="py-8"
              title="Zatím žádné poznámky"
              description="První poznámku přidáte formulářem nahoře."
            />
          ) : (
            <ol className="space-y-3">
              {task.notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-lg border border-border bg-muted/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={note.createdAt.toISOString()}
                    >
                      {noteTimeFormatter.format(note.createdAt)}
                    </time>
                    <ConfirmForm
                      action={deleteTaskNote.bind(null, note.id, task.id)}
                      message="Opravdu chcete poznámku smazat?"
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Smazat poznámku"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </ConfirmForm>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {note.body}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <ConfirmForm
        action={deleteTask.bind(null, task.id)}
        className="flex justify-end"
        message="Opravdu chcete úkol smazat? Zmizí i jeho poznámky."
      >
        <Button type="submit" variant="destructive-outline" size="sm">
          <Trash2 className="size-4" aria-hidden="true" />
          Smazat úkol
        </Button>
      </ConfirmForm>
    </div>
  );
}
