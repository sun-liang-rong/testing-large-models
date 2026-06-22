import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { ProbeController } from "./probe/probe.controller";
import { ProbeService } from "./probe/probe.service";
import { StaticController } from "./static.controller";

@Module({
  imports: [],
  controllers: [HealthController, ProbeController, StaticController],
  providers: [ProbeService]
})
export class AppModule {}
