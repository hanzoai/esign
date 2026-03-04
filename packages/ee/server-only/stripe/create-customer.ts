import { stripe } from '@hanzo/sign-lib/server-only/stripe';

type CreateCustomerOptions = {
  name: string;
  email: string;
};

export const createCustomer = async ({ name, email }: CreateCustomerOptions) => {
  return await stripe.customers.create({
    name,
    email,
  });
};
