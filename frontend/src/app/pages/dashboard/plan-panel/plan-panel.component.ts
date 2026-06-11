import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-plan-panel',
  imports: [ReactiveFormsModule, InputTextModule, DatePickerModule, ButtonModule],
  templateUrl: './plan-panel.component.html',
  styleUrl: './plan-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class PlanPanelComponent {
  @Input({ required: true }) planForm!: FormGroup;
  @Input() visible = false;
  @Input() routeSelectionActive = false;
  @Input() draftWaypointCount = 0;
  @Input() savedPlanKeys: string[] = [];
  @Input() maxPlans = 3;
  @Input() plansCount = 0;
  @Input() finishDisabled = true;
  @Input() clearAllDisabled = true;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() mapRouteClick = new EventEmitter<void>();
  @Output() finishClick = new EventEmitter<void>();
  @Output() clearAllRoutesClick = new EventEmitter<void>();

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  onVisibleChange(visible: boolean): void {
    this.visibleChange.emit(visible);
  }

  onSpeedInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitsOnly = input.value.replace(/\D/g, '');
    input.value = digitsOnly;
    this.planForm.get('speed')?.setValue(digitsOnly ? Number(digitsOnly) : null);
  }
}
