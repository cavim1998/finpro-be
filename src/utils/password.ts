import argon from "argon2";

export const hashPassword = async (plainPassword: string) => {
  return argon.hash(plainPassword);
};

export const comparePassword = async (
  plainPassword: string,
  hashedPassword: string,
) => {
  return argon.verify(hashedPassword, plainPassword);
};
