import getPort from "get-port";
import * as devProxy from "./dev-proxy.mjs";

async function startServer() {
  console.log("starting the server.......");

  const availablePort = process.env.PORT || (await getPort());

  // Opens https://{user}-mieauth.dev.bluehive.com after you approve the MIE Auth push.
  const registration = await devProxy.register({ port: availablePort, handle: "mieauth" });
  process.env.ROOT_URL = registration ? registration.url : `http://localhost:${availablePort}`;
  process.env.LOCAL_USER = devProxy.username();

  // Start up meteor
  console.log(`Starting up meteor on port ${availablePort}`);

  // if we have an argument, pass it to meteor
  const args = process.argv.slice(2);

  // if we have any args, include "--mobile-server" so that the mobile app can connect
  if (args.length > 0) {
    args.push("--mobile-server", process.env.ROOT_URL);
  }

  await devProxy.runAndUnregister(
    `meteor run ${args.join(" ")} --settings settings.json --port ${availablePort}`,
    registration,
  );
}

startServer();
