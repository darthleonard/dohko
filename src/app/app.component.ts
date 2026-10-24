import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { addIcons } from 'ionicons';
import { shieldCheckmark } from 'ionicons/icons';
import { AppPrivacyService } from './core/security/app-privacy.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {

  public isObscured$: Observable<boolean>;

  constructor(private appPrivacy: AppPrivacyService) {
    addIcons({ shieldCheckmark });
    this.isObscured$ = this.appPrivacy.isObscured$;
  }
}
