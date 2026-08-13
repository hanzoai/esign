import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

import { AppError } from '@hanzo/esign-lib/errors/app-error';
import type { TCreateAdminOrganisationRequest } from '@hanzo/esign-trpc/server/admin-router/create-admin-organisation.types';
import { ZCreateAdminOrganisationRequestSchema } from '@hanzo/esign-trpc/server/admin-router/create-admin-organisation.types';
import { useZapMutation } from '@hanzo/esign-trpc/zap/react';
import { Alert, AlertDescription } from '@hanzo/esign-ui/primitives/alert';
import { Button } from '@hanzo/esign-ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  type DialogProps,
  DialogTitle,
  DialogTrigger,
} from '@hanzo/esign-ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@hanzo/esign-ui/primitives/form/form';
import { Input } from '@hanzo/esign-ui/primitives/input';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

export type OrganisationCreateDialogProps = {
  trigger?: React.ReactNode;
  ownerUserId: number;
} & Omit<DialogProps, 'children'>;

const ZCreateAdminOrganisationFormSchema = ZCreateAdminOrganisationRequestSchema.shape.data.pick({
  name: true,
});

type TCreateOrganisationFormSchema = z.infer<typeof ZCreateAdminOrganisationFormSchema>;

export const AdminOrganisationCreateDialog = ({
  trigger,
  ownerUserId,
  ...props
}: OrganisationCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const navigate = useNavigate();

  const form = useForm({
    resolver: zodResolver(ZCreateAdminOrganisationFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const { mutateAsync: createOrganisation } = useZapMutation<
    { organisationId: string },
    TCreateAdminOrganisationRequest
  >('admin.organisation.create');

  const onFormSubmit = async ({ name }: TCreateOrganisationFormSchema) => {
    try {
      const { organisationId } = await createOrganisation({
        ownerUserId,
        data: {
          name,
        },
      });

      await navigate(`/admin/organisations/${organisationId}`);

      setOpen(false);

      toast({
        title: t`Success`,
        description: t`Organisation created`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to create a organisation. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    form.reset();
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Create organisation</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create organisation</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Create an organisation for this user</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Organisation Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert variant="neutral">
                <AlertDescription className="mt-0">
                  <Trans>
                    You will need to configure any claims or subscription after creating this
                    organisation
                  </Trans>
                </AlertDescription>
              </Alert>

              {/* <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Default claim ID</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      <Trans>Leave blank to use the default free claim</Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button
                  type="submit"
                  data-testid="dialog-create-organisation-button"
                  loading={form.formState.isSubmitting}
                >
                  <Trans>Create</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
