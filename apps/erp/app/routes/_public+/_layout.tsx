import { Heading, TooltipProvider } from "@carbon/react";
import { Trans } from "@lingui/react/macro";
import { Outlet } from "react-router";

export default function PublicRoute() {
  return (
    <TooltipProvider>
      <div className="container relative h-full flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col bg-muted p-10 lg:flex dark:border-r dark:bg-zinc-900 bg-zinc-100">
          <span className="z-50 mb-3 font-display text-2xl font-semibold">
            AGA OneForge
          </span>

          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <Heading size="display" className="text-foreground">
                <Trans>Let's build something</Trans>
                <span className="inline-block">
                  <span className="loading-dot">.</span>
                  <span className="loading-dot">.</span>
                  <span className="loading-dot">.</span>
                </span>
              </Heading>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px] ">
            <Outlet />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
