import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { EnvelopeType } from '@prisma/client';
import { ClipboardTypeIcon, LinkIcon, PlusIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { useLimits } from '@hanzo/esign-lib/server-only/limits/provider/client';
import type { TImportSource } from '@hanzo/esign-lib/universal/import';
import { TEXT_LIMIT } from '@hanzo/esign-lib/universal/import';
import { Button } from '@hanzo/esign-ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hanzo/esign-ui/primitives/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hanzo/esign-ui/primitives/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@hanzo/esign-ui/primitives/form/form';
import { Input } from '@hanzo/esign-ui/primitives/input';
import { Textarea } from '@hanzo/esign-ui/primitives/textarea';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

import { importPdf } from '../../../../server/api/files/files.client';
import { useCreateEnvelope } from './create';
import { uploadErrorMessage } from './upload-error';

export type EnvelopeImportMenuProps = {
  type: EnvelopeType;
  folderId?: string;
};

const ZPasteFormSchema = z.object({
  title: z.string().trim().max(255).optional(),
  text: z.string().trim().min(1).max(TEXT_LIMIT),
});

const ZUrlFormSchema = z.object({
  url: z.string().trim().min(1).max(2048),
});

type TPasteForm = z.infer<typeof ZPasteFormSchema>;
type TUrlForm = z.infer<typeof ZUrlFormSchema>;

/** The first line that says something, as the document's name. */
const firstLine = (text: string) =>
  text
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(#{1,6}|[-*+]|\d{1,3}[.)])\s+/, '')
        .replace(/[*_`#]/g, '')
        .trim(),
    )
    .find((line) => line.length > 0)
    ?.slice(0, 255);

/**
 * Start a document from something other than a file on this machine.
 *
 * Each entry collects what its source needs and hands back a source; the server
 * resolves it to a PDF and the envelope is created from those bytes, so nothing
 * past this menu knows where the document came from.
 */
export const EnvelopeImportMenu = ({ type, folderId }: EnvelopeImportMenuProps) => {
  const { t, i18n } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();

  const { remaining } = useLimits();

  const { create, isCreating } = useCreateEnvelope({ type, folderId });

  const [source, setSource] = useState<TImportSource['kind'] | null>(null);

  const paste = useForm<TPasteForm>({
    resolver: zodResolver(ZPasteFormSchema),
    defaultValues: { title: '', text: '' },
  });

  const link = useForm<TUrlForm>({
    resolver: zodResolver(ZUrlFormSchema),
    defaultValues: { url: '' },
  });

  useEffect(() => {
    if (source === null) {
      paste.reset();
      link.reset();
    }
  }, [source, paste, link]);

  const submit = async (resolved: TImportSource) => {
    try {
      if (await create([await importPdf(resolved)])) {
        setSource(null);
      }
    } catch (err) {
      console.error(err);

      toast({
        title: t`Import failed`,
        description: i18n._(uploadErrorMessage(err, type)),
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  const busy = isCreating || paste.formState.isSubmitting || link.formState.isSubmitting;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            loading={busy}
            disabled={remaining.documents === 0 || !user.emailVerified}
            data-testid="envelope-import-button"
          >
            {!busy && <PlusIcon className="mr-2 h-4 w-4" />}
            <Trans>Import</Trans>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setSource('text')}>
            <ClipboardTypeIcon className="mr-2 h-4 w-4" />
            <Trans>Paste content</Trans>
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setSource('url')}>
            <LinkIcon className="mr-2 h-4 w-4" />
            <Trans>Import from URL</Trans>
          </DropdownMenuItem>

          {/*
            A source is one more item here and one more case in the resolver
            (esign-lib/server-only/import.ts). Google Drive is next and waits on
            a Google OAuth client id (drive.file) plus a Picker API key: the
            picker returns a file id, the resolver exchanges it for bytes.
          */}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={source === 'text'} onOpenChange={(open) => !open && setSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Paste content</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                Paste text or Markdown. It becomes a PDF you can place fields on and send for
                signature.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...paste}>
            <form
              onSubmit={paste.handleSubmit(
                async ({ title, text }) =>
                  await submit({
                    kind: 'text',
                    title: title?.trim() || firstLine(text) || t`Pasted document`,
                    text,
                  }),
              )}
            >
              <fieldset disabled={busy} className="space-y-4">
                <FormField
                  control={paste.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Title</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={t`Taken from the first line`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paste.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Content</Trans>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="h-64 font-mono text-xs"
                          placeholder={t`# Mutual NDA — both parties agree...`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setSource(null)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit" loading={busy}>
                    <Trans>Create</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={source === 'url'} onOpenChange={(open) => !open && setSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Import from URL</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                The address of a PDF we can reach. A GitHub file page works — paste it as you see
                it.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...link}>
            <form
              onSubmit={link.handleSubmit(async ({ url }) => await submit({ kind: 'url', url }))}
            >
              <fieldset disabled={busy} className="space-y-4">
                <FormField
                  control={link.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Document URL</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://github.com/hanzoai/sign/blob/main/terms.pdf"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setSource(null)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit" loading={busy}>
                    <Trans>Import</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};
