import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";

const templatesDir = join(import.meta.url, "../templates");

type TemplateData = {
  verifyLink?: string;
  verificationCode?: string;
  resetLink?: string;
  fullName?: string;
  dashboardLink?: string;
};

export const compileTemplate = (templateName: string, data: TemplateData) => {
  const templatePath = join(
    process.cwd(),
    "src/modules/mail/templates",
    `${templateName}.hbs`,
  );
  const templateContent = readFileSync(templatePath, "utf-8");
  const template = Handlebars.compile(templateContent);
  return template(data);
};
