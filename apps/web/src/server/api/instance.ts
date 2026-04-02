import { fetchAPI } from "./client";

export type InstanceStatus = {
  selfHosted: boolean;
  initialized: boolean;
  allowSetup: boolean;
  allowPublicSignup: boolean;
};

export const getStatus = async (): Promise<InstanceStatus> => {
  return fetchAPI("/instance/status");
};

export const bootstrap = async (data: {
  name: string;
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  user: {
    id: string;
    email: string;
    name: string;
  };
}> => {
  return fetchAPI("/instance/bootstrap", {
    method: "POST",
    body: JSON.stringify(data),
  });
};
