"use client";

import Link from "next/link";
import { FolderPlus, Save, Trash2 } from "lucide-react";

import {
  createProject,
  deleteProject,
  updateProject,
} from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InputField, SelectField, TextareaField } from "@/components/ui/field";
import { Priority, ProjectStatus } from "@/generated/prisma/enums";
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
} from "@/lib/project-task";

export type ProjectClientOption = {
  id: string;
  name: string;
};

type ProjectFormValues = {
  clientId: string;
  description: string;
  dueDate: string;
  name: string;
  priority: Priority;
  startDate: string;
  status: ProjectStatus;
};

type ProjectFormProps = {
  clients: ProjectClientOption[];
  defaultValues?: Partial<ProjectFormValues>;
  projectId?: string;
  taskCount?: number;
};

export function ProjectForm({
  clients,
  defaultValues,
  projectId,
  taskCount = 0,
}: ProjectFormProps) {
  const formAction = projectId
    ? updateProject.bind(null, projectId)
    : createProject;
  const deleteAction = projectId ? deleteProject.bind(null, projectId) : null;

  const values: ProjectFormValues = {
    clientId: defaultValues?.clientId ?? "",
    description: defaultValues?.description ?? "",
    dueDate: defaultValues?.dueDate ?? "",
    name: defaultValues?.name ?? "",
    priority: defaultValues?.priority ?? Priority.MEDIUM,
    startDate: defaultValues?.startDate ?? "",
    status: defaultValues?.status ?? ProjectStatus.ACTIVE,
  };

  return (
    <div className="space-y-6">
      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Údaje projektu</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                className="md:col-span-2"
                label="Název projektu"
                name="name"
                required
                placeholder="Např. Redesign webu"
                defaultValue={values.name}
              />

              <SelectField
                label="Odběratel"
                name="clientId"
                defaultValue={values.clientId}
                hint={
                  clients.length === 0 ? (
                    <>
                      Adresář je prázdný.{" "}
                      <Link
                        href="/clients/new"
                        className="underline underline-offset-4"
                      >
                        Přidat odběratele
                      </Link>
                    </>
                  ) : (
                    "Nechte prázdné u interního projektu."
                  )
                }
              >
                <option value="">— bez odběratele —</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Stav"
                name="status"
                defaultValue={values.status}
              >
                {PROJECT_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABELS[status]}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Priorita"
                name="priority"
                defaultValue={values.priority}
              >
                {PRIORITY_ORDER.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </SelectField>

              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="Začátek"
                  name="startDate"
                  type="date"
                  defaultValue={values.startDate}
                />
                <InputField
                  label="Termín"
                  name="dueDate"
                  type="date"
                  defaultValue={values.dueDate}
                />
              </div>

              <TextareaField
                className="md:col-span-2"
                label="Popis"
                name="description"
                placeholder="Zadání, rozsah, domluvené podmínky…"
                defaultValue={values.description}
                rows={4}
              />
            </div>
          </CardContent>

          <CardFooter className="justify-end">
            <Button type="submit">
              {projectId ? (
                <>
                  <Save className="size-4" aria-hidden="true" />
                  Uložit změny
                </>
              ) : (
                <>
                  <FolderPlus className="size-4" aria-hidden="true" />
                  Založit projekt
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {deleteAction ? (
        <form
          action={deleteAction}
          className="flex justify-end"
          onSubmit={(event) => {
            const message =
              taskCount > 0
                ? `Projekt má ${taskCount} úkolů. Smazáním zmizí i ty včetně poznámek. Pokračovat?`
                : "Opravdu chcete projekt smazat?";

            if (!window.confirm(message)) {
              event.preventDefault();
            }
          }}
        >
          <Button type="submit" variant="destructive" size="sm">
            <Trash2 className="size-4" aria-hidden="true" />
            Smazat projekt
          </Button>
        </form>
      ) : null}
    </div>
  );
}
