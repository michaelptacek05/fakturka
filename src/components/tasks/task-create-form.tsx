"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";

import { createTask } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputField, SelectField, TextareaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Priority, TaskStatus } from "@/generated/prisma/enums";
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  TASK_BOARD_COLUMNS,
  TASK_STATUS_LABELS,
} from "@/lib/project-task";

export type TaskProjectOption = {
  clientName: string | null;
  id: string;
  name: string;
};

type TaskCreateFormProps = {
  /** Na detailu projektu je projekt daný a výběr se nezobrazuje. */
  fixedProjectId?: string;
  /** Nadpis a tlačítko zůstanou v řádku, formulář se otevře pod nimi. */
  header?: ReactNode;
  projects: TaskProjectOption[];
  returnTo: string;
};

export function TaskCreateForm({
  fixedProjectId,
  header,
  projects,
  returnTo,
}: TaskCreateFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const formId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  function closeForm() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  const trigger = projects.length === 0 && !fixedProjectId ? null : (
    <Button
      ref={triggerRef}
      type="button"
      variant={isOpen ? "outline" : "default"}
      aria-expanded={isOpen}
      aria-controls={formId}
      onClick={() => (isOpen ? closeForm() : setIsOpen(true))}
    >
      {isOpen ? (
        <X className="size-4" aria-hidden="true" />
      ) : (
        <Plus className="size-4" aria-hidden="true" />
      )}
      {isOpen ? "Zavřít formulář" : "Přidat úkol"}
    </Button>
  );

  const form = isOpen ? (
    <Card className="w-full min-w-0">
      <CardContent>
        <form
          id={formId}
          action={createTask}
          className="space-y-4"
          aria-labelledby={`${formId}-title`}
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          {fixedProjectId ? (
            <input type="hidden" name="projectId" value={fixedProjectId} />
          ) : null}

          <div className="space-y-1">
            <h3 id={`${formId}-title`} className="text-base font-semibold">
              Nový úkol
            </h3>
            <p className="text-sm text-muted-foreground">
              Stačí název{fixedProjectId ? "." : " a projekt."} Ostatní údaje
              můžete doplnit později.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              className="md:col-span-2"
              label="Název úkolu"
              name="title"
              required
              autoFocus
              placeholder="Např. Nasadit novou verzi"
            />

            {fixedProjectId ? null : (
              <SelectField
                className="md:col-span-2"
                label="Projekt"
                name="projectId"
                required
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                    {project.clientName ? ` — ${project.clientName}` : ""}
                  </option>
                ))}
              </SelectField>
            )}

            <SelectField label="Stav" name="status" defaultValue={TaskStatus.TODO}>
              {TASK_BOARD_COLUMNS.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Priorita"
              name="priority"
              defaultValue={Priority.MEDIUM}
            >
              {PRIORITY_ORDER.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </SelectField>

            <InputField label="Termín" name="dueDate" type="date" />

            <TextareaField
              className="md:col-span-2"
              label="Popis"
              name="description"
              placeholder="Co je potřeba udělat…"
              rows={3}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={closeForm}
            >
              Zrušit
            </Button>
            <SubmitButton pendingLabel="Vytvářím úkol…">
              <Plus className="size-4" aria-hidden="true" />
              Vytvořit úkol
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  ) : null;

  return header ? (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">{header}</div>
        {trigger}
      </div>
      {form}
    </div>
  ) : (
    <>
      {trigger}
      {form}
    </>
  );
}
