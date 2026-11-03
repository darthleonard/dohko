import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  constructor(private languageService: LanguageService) {}

  public transform(
    key: string,
    params?: Record<string, string | number>,
  ): string {
    return this.languageService.instant(key, params);
  }
}
