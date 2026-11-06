"""Read-only helper installation boundaries; never starts launchd or a real server."""
import importlib.util
import json
from pathlib import Path
import plistlib
import stat
import tempfile
import unittest
from unittest.mock import Mock, patch

SPEC = importlib.util.spec_from_file_location(
    "helper_installer", Path(__file__).resolve().parents[1] / "scripts/install-ottplay-media-helper.py")
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class HelperInstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.binary = self.root / "source binary"
        self.binary.write_bytes(b"prepared-binary")
        self.binary.chmod(0o700)
        self.media = self.root / "NAS folder"
        self.media.mkdir()
        self.config = installer.plan(self.binary, [self.media], self.root / "private state", home=self.root)

    def tearDown(self):
        self.temp.cleanup()

    def test_prepare_preserves_secret_and_has_only_loopback_readonly_configuration(self):
        original = self.media / "movie.mp4"
        original.write_bytes(b"original")
        first = installer.prepare(self.config)
        second = installer.prepare(self.config)
        self.assertEqual(first, second)
        self.assertEqual(first["ProgramArguments"][1:], ["--host", "127.0.0.1", "--port", "8448"])
        self.assertEqual(json.loads(first["EnvironmentVariables"]["OTT_OFFLINE_MEDIA_READONLY_PATHS"]), [str(self.media)])
        self.assertEqual(first["EnvironmentVariables"]["OTT_OFFLINE_MEDIA_TOKEN"],
                         (self.config["state"] / "token").read_text().strip())
        self.assertEqual(plistlib.loads(self.config["plist"].read_bytes()), first)
        self.assertEqual(original.read_bytes(), b"original")
        self.assertEqual(list(self.media.iterdir()), [original])
        for file in (self.config["plist"], self.config["state"] / "token", self.config["state"] / "library-url.txt"):
            self.assertEqual(stat.S_IMODE(file.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.config["state"].stat().st_mode), 0o700)

    def test_private_state_cannot_be_inside_or_contain_a_media_root(self):
        for state in (self.media, self.media / "private", self.root):
            with self.subTest(state=state), self.assertRaises(ValueError):
                installer.plan(self.binary, [self.media], state, home=self.root)

    def test_lan_requires_opt_in_and_an_explicit_private_interface(self):
        for host in ("10.2.3.4", "172.16.1.2", "172.31.255.254", "192.168.1.2", "fd12::2", "fc00::1"):
            with self.subTest(host=host):
                with self.assertRaises(ValueError):
                    installer.listen_address(host)
                self.assertEqual(installer.listen_address(host, True), host)
        for host in ("0.0.0.0", "::", "8.8.8.8", "172.15.1.2", "172.32.1.2", "169.254.1.2",
                     "100.64.1.2", "2001:4860::1", "fe80::1", "::ffff:192.168.1.2", "::ffff:127.0.0.1",
                     "::ffff:7f00:1", "fd12::1%en0", "localhost"):
            with self.subTest(host=host), self.assertRaises(ValueError):
                installer.listen_address(host, True)

    def test_lan_prepare_keeps_same_readonly_roots_and_private_token(self):
        loopback = installer.prepare(self.config)
        for host in ("192.168.1.2", "fd12::2"):
            config = installer.plan(self.binary, [self.media], self.config["state"],
                                    home=self.root, host=host, allow_lan=True)
            agent = installer.prepare(config)
            self.assertEqual(agent["EnvironmentVariables"], loopback["EnvironmentVariables"])
            self.assertEqual(agent["ProgramArguments"][1:],
                             ["--host", host, "--port", "8448", "--allow-lan-local-media"])
            token = agent["EnvironmentVariables"]["OTT_OFFLINE_MEDIA_TOKEN"]
            self.assertEqual((config["state"] / "library-url.txt").read_text().strip(),
                             f"http://{installer.authority(config)}/offline-media/{token}")
            self.assertEqual(stat.S_IMODE(config["plist"].stat().st_mode), 0o600)
        restored = installer.prepare(self.config)
        self.assertEqual(restored, loopback)

    def test_nonabsolute_media_path_and_invalid_label_or_port_are_rejected(self):
        with self.assertRaises(ValueError):
            installer.plan(self.binary, ["relative"], self.root / "state")
        for kwargs in ({"port": 0}, {"port": 65536}, {"label": "../other"}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                installer.plan(self.binary, [self.media], self.root / "state", **kwargs)

    def test_symlink_subdirectories_and_token_are_rejected(self):
        for name in ("bin", "logs", "library", "token"):
            state = self.config["state"]
            state.mkdir(mode=0o700, exist_ok=True)
            outside = self.root / ("outside-" + name)
            if name == "token":
                outside.write_text("secret")
            else:
                outside.mkdir()
            (state / name).symlink_to(outside)
            with self.subTest(name=name), self.assertRaises(ValueError):
                installer.prepare(self.config)
            (state / name).unlink()

    def test_insecure_existing_token_is_not_silently_used(self):
        self.config["state"].mkdir(mode=0o700)
        token = self.config["state"] / "token"
        token.write_text("a" * 40)
        token.chmod(0o644)
        with self.assertRaises(ValueError):
            installer.prepare(self.config)

    def test_port_conflict_does_not_stop_another_service(self):
        with patch.object(installer.subprocess, "run", side_effect=[
            Mock(returncode=0, stdout="p123\n"), Mock(returncode=0, stdout="pid = 456\n")
        ]) as run:
            with self.assertRaises(RuntimeError):
                installer.check_port(self.config)
            self.assertEqual(run.call_count, 2)
            self.assertFalse(any("bootout" in call.args[0] for call in run.call_args_list))

    def test_matching_launchd_listener_is_allowed_for_update(self):
        with patch.object(installer.subprocess, "run", side_effect=[
            Mock(returncode=0, stdout="p123\n"), Mock(returncode=0, stdout=" pid = 123\n")
        ]):
            installer.check_port(self.config)

    def test_start_waits_for_its_own_label_to_disappear_before_bootstrap(self):
        installer.prepare(self.config)
        health = Mock(status=200)
        health.__enter__ = Mock(return_value=health)
        health.__exit__ = Mock(return_value=False)
        catalog = Mock(status=200)
        catalog.__enter__ = Mock(return_value=catalog)
        catalog.__exit__ = Mock(return_value=False)
        catalog.read.return_value = b'{"readOnly":true,"directSources":false,"uploadUrl":""}'
        opener = Mock()
        opener.open.side_effect = [health, catalog]
        with patch.object(installer, "check_port"), \
                patch.object(installer.subprocess, "run", side_effect=[
                    Mock(returncode=0), Mock(returncode=0), Mock(returncode=0),
                    Mock(returncode=1), Mock(returncode=0),
                ]) as run, \
                patch.object(installer.urllib.request, "build_opener", return_value=opener), \
                patch.object(installer.time, "sleep") as sleep:
            installer.start(self.config)
        commands = [call.args[0] for call in run.call_args_list]
        target = f"gui/{installer.os.getuid()}/{self.config['label']}"
        self.assertEqual(commands[:4], [["launchctl", "bootout", target]] +
                         [["launchctl", "print", target]] * 3)
        self.assertEqual(commands[4][1], "bootstrap")
        self.assertEqual(sleep.call_count, 2)

    def test_start_stops_after_bounded_unload_wait_without_bootstrap(self):
        with patch.object(installer, "check_port"), \
                patch.object(installer.subprocess, "run", return_value=Mock(returncode=0)) as run, \
                patch.object(installer.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "finished unloading"):
                installer.start(self.config)
        self.assertEqual(run.call_count, 21)
        self.assertFalse(any(call.args[0][1] == "bootstrap" for call in run.call_args_list))

    def test_start_checks_selected_lan_interface_for_health_and_catalog(self):
        for host, target in (("192.168.1.2", "192.168.1.2:8448"), ("fd12::2", "[fd12::2]:8448")):
            config = installer.plan(self.binary, [self.media], self.config["state"],
                                    home=self.root, host=host, allow_lan=True)
            installer.prepare(config)
            health = Mock(status=200)
            health.__enter__ = Mock(return_value=health)
            health.__exit__ = Mock(return_value=False)
            catalog = Mock(status=200)
            catalog.__enter__ = Mock(return_value=catalog)
            catalog.__exit__ = Mock(return_value=False)
            catalog.read.return_value = b'{"readOnly":true,"directSources":false,"uploadUrl":""}'
            opener = Mock()
            opener.open.side_effect = [health, catalog]
            with self.subTest(host=host), patch.object(installer, "check_port"), \
                    patch.object(installer.subprocess, "run", return_value=Mock(returncode=1)), \
                    patch.object(installer.urllib.request, "build_opener", return_value=opener):
                installer.start(config)
            self.assertEqual(opener.open.call_args_list[0].args[0], f"http://{target}/health")
            self.assertEqual(opener.open.call_args_list[1].args[0],
                             (config["state"] / "library-url.txt").read_text().strip())

    def test_health_alone_cannot_accept_an_unrelated_server(self):
        installer.prepare(self.config)
        health = Mock(status=200)
        health.__enter__ = Mock(return_value=health)
        health.__exit__ = Mock(return_value=False)
        catalog = Mock(status=200)
        catalog.__enter__ = Mock(return_value=catalog)
        catalog.__exit__ = Mock(return_value=False)
        catalog.read.return_value = b'{"readOnly":false,"directSources":false,"uploadUrl":""}'
        opener = Mock()
        opener.open.side_effect = [health, catalog] * 8
        with patch.object(installer, "check_port"), patch.object(installer.subprocess, "run", return_value=Mock(returncode=1)), \
                patch.object(installer.urllib.request, "build_opener", return_value=opener), \
                patch.object(installer.time, "sleep"):
            with self.assertRaises(RuntimeError):
                installer.start(self.config)


if __name__ == "__main__":
    unittest.main()
