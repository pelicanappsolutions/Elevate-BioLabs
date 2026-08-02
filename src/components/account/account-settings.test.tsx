import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  updateAccountNameMock,
  changeEmailMock,
  changePasswordMock,
  updateAvatarMock,
  updateMarketingPrefMock,
  sessionUpdateMock,
  toastMock,
} = vi.hoisted(() => ({
  updateAccountNameMock: vi.fn(),
  changeEmailMock: vi.fn(),
  changePasswordMock: vi.fn(),
  updateAvatarMock: vi.fn(),
  updateMarketingPrefMock: vi.fn(),
  sessionUpdateMock: vi.fn().mockResolvedValue(undefined),
  toastMock: vi.fn(),
}));

vi.mock("@/actions/account", () => ({
  updateAccountName: updateAccountNameMock,
  changeEmail: changeEmailMock,
  changePassword: changePasswordMock,
  updateAvatar: updateAvatarMock,
  updateMarketingPref: updateMarketingPrefMock,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ update: sessionUpdateMock, data: null, status: "authenticated" }),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("next/image", () => ({
  default: ({ fill, sizes, alt, ...rest }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element -- test stub for next/image
    <img alt={typeof alt === "string" ? alt : ""} {...rest} />
  ),
}));

import { AccountSettings } from "@/components/account/account-settings";

const BASE_PROPS = {
  name: "Jane Doe",
  email: "jane@example.com",
  image: null as string | null,
  marketingOptIn: false,
  memberSince: "2026-01-01T00:00:00.000Z",
  hasPassword: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionUpdateMock.mockResolvedValue(undefined);
});

describe("AccountSettings — profile", () => {
  it("disables Save name until the name actually changes, then saves it", async () => {
    updateAccountNameMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AccountSettings {...BASE_PROPS} />);

    const saveBtn = screen.getByRole("button", { name: /save name/i });
    expect(saveBtn).toBeDisabled();

    const nameInput = screen.getByLabelText(/display name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Janet Doe");
    expect(saveBtn).toBeEnabled();

    await user.click(saveBtn);

    await waitFor(() => {
      expect(updateAccountNameMock).toHaveBeenCalledWith({ name: "Janet Doe" });
    });
    expect(sessionUpdateMock).toHaveBeenCalledWith({ name: "Janet Doe" });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Name updated" }));
  });

  it("shows a destructive toast when saving the name fails", async () => {
    updateAccountNameMock.mockResolvedValue({ ok: false, error: "Server exploded" });
    const user = userEvent.setup();
    render(<AccountSettings {...BASE_PROPS} />);

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), "New Name");
    await user.click(screen.getByRole("button", { name: /save name/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't update", description: "Server exploded", variant: "destructive" })
      );
    });
  });

  it("uploads a new avatar and updates the session picture", async () => {
    updateAvatarMock.mockResolvedValue({ ok: true, url: "/uploads/avatars/new.png" });
    const { container } = render(<AccountSettings {...BASE_PROPS} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "avatar.png", { type: "image/png" });

    const user = userEvent.setup();
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(updateAvatarMock).toHaveBeenCalledTimes(1);
    });
    const sentFormData = updateAvatarMock.mock.calls[0]![0] as FormData;
    expect(sentFormData.get("avatar")).toBe(file);
    expect(sessionUpdateMock).toHaveBeenCalledWith({ picture: "/uploads/avatars/new.png" });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Photo updated" }));
  });
});

describe("AccountSettings — email", () => {
  it("shows a locked message and no form when the account has no password", () => {
    render(<AccountSettings {...BASE_PROPS} hasPassword={false} />);
    expect(screen.getByText(/set a password first/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^new email$/i)).not.toBeInTheDocument();
  });

  it("submits a new email with the current password and clears the form on success", async () => {
    changeEmailMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AccountSettings {...BASE_PROPS} />);

    await user.type(screen.getByLabelText(/^new email$/i), "new@example.com");
    await user.type(document.getElementById("email-cur-pw") as HTMLElement, "hunter2");
    await user.click(screen.getByRole("button", { name: /update email/i }));

    await waitFor(() => {
      expect(changeEmailMock).toHaveBeenCalledWith({ currentPassword: "hunter2", newEmail: "new@example.com" });
    });
    expect(sessionUpdateMock).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(screen.getByLabelText(/^new email$/i)).toHaveValue("");
  });

  it("shows an inline error when changing email fails", async () => {
    changeEmailMock.mockResolvedValue({ ok: false, error: "Current password is incorrect." });
    const user = userEvent.setup();
    render(<AccountSettings {...BASE_PROPS} />);

    await user.type(screen.getByLabelText(/^new email$/i), "new@example.com");
    await user.type(document.getElementById("email-cur-pw") as HTMLElement, "wrong");
    await user.click(screen.getByRole("button", { name: /update email/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect.");
  });
});

describe("AccountSettings — password", () => {
  it("shows a passwordless message when the account has no password", () => {
    render(<AccountSettings {...BASE_PROPS} hasPassword={false} />);
    expect(screen.getByText(/signs in without a password/i)).toBeInTheDocument();
  });

  it("submits current/new/confirm password and clears the form on success", async () => {
    changePasswordMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AccountSettings {...BASE_PROPS} />);

    await user.type(document.getElementById("cur-pw") as HTMLElement, "OldPass1");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPass1");
    await user.type(screen.getByLabelText(/confirm new password/i), "NewPass1");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith({
        currentPassword: "OldPass1",
        newPassword: "NewPass1",
        confirmPassword: "NewPass1",
      });
    });
    expect(screen.getByLabelText(/^new password$/i)).toHaveValue("");
  });

  it("shows an inline error when changing password fails", async () => {
    changePasswordMock.mockResolvedValue({ ok: false, error: "Current password is incorrect." });
    const user = userEvent.setup();
    render(<AccountSettings {...BASE_PROPS} />);

    await user.type(document.getElementById("cur-pw") as HTMLElement, "wrong");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPass1");
    await user.type(screen.getByLabelText(/confirm new password/i), "NewPass1");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect.");
  });
});

describe("AccountSettings — marketing preference", () => {
  it("is hidden entirely for admins (showMarketing=false)", () => {
    render(<AccountSettings {...BASE_PROPS} showMarketing={false} />);
    expect(screen.queryByText(/marketing emails/i)).not.toBeInTheDocument();
  });

  it("toggles the preference on for customers and calls the API", async () => {
    updateMarketingPrefMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AccountSettings {...BASE_PROPS} showMarketing marketingOptIn={false} />);

    const checkbox = screen.getByRole("checkbox", { name: /marketing emails/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);

    await waitFor(() => {
      expect(updateMarketingPrefMock).toHaveBeenCalledWith({ optIn: true });
    });
    expect(checkbox).toBeChecked();
  });

  it("reverts the checkbox and toasts an error when the API call fails", async () => {
    updateMarketingPrefMock.mockResolvedValue({ ok: false, error: "boom" });
    const user = userEvent.setup();
    render(<AccountSettings {...BASE_PROPS} showMarketing marketingOptIn={false} />);

    const checkbox = screen.getByRole("checkbox", { name: /marketing emails/i });
    await user.click(checkbox);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't save preference", description: "boom", variant: "destructive" })
      );
    });
    expect(checkbox).not.toBeChecked();
  });
});
