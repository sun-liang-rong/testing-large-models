import { Body, Controller, Post } from "@nestjs/common";
import { RunProbeDto } from "./dto/run-probe.dto";
import { ProbeService } from "./probe.service";

@Controller("api/probe")
export class ProbeController {
  constructor(private readonly probeService: ProbeService) {}

  @Post()
  run(@Body() dto: RunProbeDto) {
    return this.probeService.run(dto);
  }

  @Post("ping")
  ping(@Body() dto: RunProbeDto) {
    return this.probeService.ping(dto);
  }
}
