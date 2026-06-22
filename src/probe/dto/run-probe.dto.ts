import {
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class EndpointDto {
  @IsUrl({ require_tld: false, require_protocol: true })
  baseUrl!: string;

  @IsString()
  apiKey!: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

export class RunProbeDto {
  @ValidateNested()
  @Type(() => EndpointDto)
  target!: EndpointDto;
}
