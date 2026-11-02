import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';

export function Button({ asChild, ...props }: ComponentProps<'button'> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component className="inline-flex rounded-md bg-teal-700 px-4 py-2 text-white" {...props} />;
}
